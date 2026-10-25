import fs from 'fs'
import path from 'path'
import { sendJson } from './common.js'

const valuesForIdentity = (value) => [value?.id, value?.code, value?.name]
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter(Boolean)

const sameMappingScope = (candidate, folderRemote) => {
    if (candidate?.service !== folderRemote.service || candidate?.collection !== folderRemote.collection) return false
    const leftQuery = candidate.query || {}
    const rightQuery = folderRemote.query || {}
    const keys = new Set([...Object.keys(leftQuery), ...Object.keys(rightQuery)])
    return [...keys].every((key) => String(leftQuery[key] ?? '') === String(rightQuery[key] ?? ''))
}

const getFolderRemote = ({ targetPath, resolvedTarget, metaRoot, contentRoot, withinFolder }) => {
    const relative = path.relative(contentRoot, resolvedTarget)
    const segments = relative.split(path.sep).filter(Boolean)
    if (segments.length < 2) return { error: 'Remote folder comparison requires a service and collection folder.' }

    const indexPath = path.join(metaRoot, ...segments, 'index.json')
    let folderMeta = {}
    if (fs.existsSync(indexPath)) {
        try {
            folderMeta = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
        } catch {
            return { error: 'The folder index.json metadata is invalid JSON.' }
        }
    }

    const configuredRemote = folderMeta.remote || folderMeta.remotes?.origin || {}
    const query = { ...(configuredRemote.query || {}) }
    for (let index = 2; index < segments.length; index += 1) {
        query[`path-${index - 1}`] = segments[index]
    }
    const remote = {
        service: configuredRemote.service || segments[0],
        collection: configuredRemote.collection || segments[1],
        ...(Object.keys(query).length ? { query } : {})
    }
    if (!remote.service || !remote.collection) return { error: 'No remote service and collection are mapped to this folder.' }

    const metaFolder = path.resolve(metaRoot, ...segments)
    if (!withinFolder(path.resolve(metaRoot), metaFolder)) return { error: 'Invalid folder metadata path.' }
    return { remote, segments, indexPath, targetPath }
}

export const handleRemoteDirectoryApi = async ({ req, res, port, configFolder, resolveApiDirectoryTarget, withinFolder, file, logger, readRemoteResource = null }) => {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
    if (requestUrl.pathname !== '/api/remote-directory' || req.method !== 'GET') return false

    const targetPath = String(requestUrl.searchParams.get('path') || '').trim()
    if (!targetPath) {
        sendJson(res, 400, { ok: false, error: 'A folder path is required.' })
        return true
    }

    const resolvedTarget = resolveApiDirectoryTarget(configFolder, targetPath)
    const contentRoot = file.path('$content')
    if (!withinFolder(contentRoot, resolvedTarget) || !withinFolder(file.path('$cwd'), resolvedTarget) || !fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isDirectory()) {
        sendJson(res, 400, { ok: false, error: 'The selected content folder is invalid.' })
        return true
    }

    try {
        if (!withinFolder(fs.realpathSync(contentRoot), fs.realpathSync(resolvedTarget))) {
            sendJson(res, 400, { ok: false, error: 'The folder resolves outside the content directory.' })
            return true
        }

        const mapping = getFolderRemote({
            targetPath,
            resolvedTarget,
            metaRoot: file.path('$meta'),
            contentRoot,
            withinFolder
        })
        if (mapping.error) {
            sendJson(res, 400, { ok: false, error: mapping.error })
            return true
        }

        const localEntries = fs.readdirSync(resolvedTarget, { withFileTypes: true })
        const metadataFolder = path.join(file.path('$meta'), ...mapping.segments)
        const metadataEntries = fs.existsSync(metadataFolder)
            ? fs.readdirSync(metadataFolder).filter((name) => name.toLowerCase().endsWith('.json') && !['index.json', 'schema.json'].includes(name.toLowerCase()))
            : []
        const mappedMetaItems = metadataEntries.flatMap((name) => {
            try {
                const record = JSON.parse(fs.readFileSync(path.join(metadataFolder, name), 'utf8'))
                const remote = record.remote || record.remotes?.origin
                if (!remote?.id || !sameMappingScope(remote, mapping.remote)) return []
                const localFileName = typeof record.local?.file === 'string' ? path.basename(record.local.file) : ''
                return [{
                    name: localFileName || `${record.code || record.id || remote.id}.json`,
                    id: remote.id,
                    code: record.code,
                    modifiedAt: record.timestamp || record.updatedAt || remote.timestamp || remote.updatedAt || null,
                    remote,
                    identities: [...valuesForIdentity(record), ...valuesForIdentity(remote), path.basename(name, path.extname(name)).toLowerCase()]
                        .filter(Boolean),
                    localFileName
                }]
            } catch {
                return []
            }
        })
        const metadataLookup = new Map()
        mappedMetaItems.forEach((item) => item.identities.forEach((identity) => {
            if (!metadataLookup.has(identity)) metadataLookup.set(identity, item)
        }))

        let remoteItems = []
        let remoteAvailable = false
        let remoteError = ''
        try {
            if (!readRemoteResource) readRemoteResource = (await import('../../lib/helpers/request.js')).read
            const remoteResult = await readRemoteResource({ type: 'http', config: mapping.remote })
            remoteItems = Array.isArray(remoteResult)
                ? remoteResult
                : Array.isArray(remoteResult?.items)
                    ? remoteResult.items
                    : remoteResult && typeof remoteResult === 'object'
                        ? [remoteResult]
                        : []
            remoteAvailable = true
        } catch (error) {
            remoteError = error.message || 'Unable to refresh the remote folder listing.'
        }
        const remoteLookup = new Map()
        remoteItems.forEach((item, index) => {
            valuesForIdentity(item).forEach((identity) => {
                if (!remoteLookup.has(identity)) remoteLookup.set(identity, index)
            })
        })

        const matchedRemoteIndices = new Set()
        const matchedMetaItems = new Set()
        const items = localEntries.map((entry) => {
            const localPath = path.join(resolvedTarget, entry.name)
            let localData = null
            if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') {
                try { localData = JSON.parse(fs.readFileSync(localPath, 'utf8')) } catch { localData = null }
            }
            const localIdentity = valuesForIdentity(localData)
            const fallbackName = path.basename(entry.name, path.extname(entry.name)).toLowerCase()
            if (entry.isFile() && !localIdentity.includes(fallbackName)) localIdentity.push(fallbackName)
            const match = localIdentity.map((identity) => remoteLookup.get(identity)).find((index) => index != null)
            const metadataMatch = entry.isFile()
                ? localIdentity.map((identity) => metadataLookup.get(identity)).find(Boolean)
                : null
            if (match != null) matchedRemoteIndices.add(match)
            if (metadataMatch) matchedMetaItems.add(metadataMatch)
            const relativePath = path.relative(file.path('$cwd'), localPath).replaceAll('\\', '/')
            return {
                name: entry.name,
                path: targetPath.startsWith('$') ? `${targetPath.replace(/\/$/, '')}/${entry.name}` : relativePath,
                type: entry.isDirectory() ? 'directory' : 'file',
                localExists: true,
                localModifiedAt: fs.statSync(localPath).mtime.toISOString(),
                remoteExists: entry.isFile() && (match != null || Boolean(metadataMatch)),
                remoteItem: match == null ? metadataMatch : remoteItems[match],
                remoteModifiedAt: (match == null ? metadataMatch : remoteItems[match])?.updatedAt || (match == null ? metadataMatch : remoteItems[match])?.modifiedAt || (match == null ? metadataMatch : remoteItems[match])?.timestamp || (match == null ? metadataMatch : remoteItems[match])?.timeStamp || null
            }
        })

        if (remoteAvailable) {
            remoteItems.forEach((item, index) => {
                if (matchedRemoteIndices.has(index)) return
                const identity = String(item?.code || item?.id || item?.name || `remote-${index + 1}`)
                const name = identity.toLowerCase().endsWith('.json') ? identity : `${identity}.json`
                items.push({ name, path: null, type: 'file', localExists: false, remoteExists: true, remoteItem: item })
            })
        }
        mappedMetaItems.forEach((item) => {
            if (matchedMetaItems.has(item)) return
            const localExists = localEntries.some((entry) => entry.isFile() && (
                entry.name.toLowerCase() === item.name.toLowerCase() ||
                path.basename(entry.name, path.extname(entry.name)).toLowerCase() === String(item.id || '').toLowerCase()
            ))
            if (!localExists && !remoteItems.some((remoteItem) => valuesForIdentity(remoteItem).some((identity) => item.identities.includes(identity)))) {
                items.push({ name: item.name, path: null, type: 'file', localExists: false, remoteExists: true, remoteItem: item })
            }
        })

        sendJson(res, 200, {
            ok: true,
            path: targetPath,
            mapping: mapping.remote,
            remoteAvailable,
            ...(remoteError ? { error: remoteError } : {}),
            fetchedAt: new Date().toISOString(),
            items
        })
    } catch (error) {
        logger?.('handlers.serve')?.error?.(error)
        sendJson(res, 502, { ok: false, error: error.message || 'Unable to refresh the remote folder listing.' })
    }
    return true
}
