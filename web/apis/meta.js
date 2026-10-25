import fs from 'fs'
import path from 'path'
import { readJsonBody, sendJson } from './common.js'
import { resolveEndpointForFile, endpointSchemaPath } from '../../lib/helpers/schema-validation.js'

const normalizeMetaFileName = (name, fallback = 'meta.json') => {
    const raw = String(name || '').trim()
    const base = path.basename(raw || fallback).replace(/[^a-zA-Z0-9_.-]/g, '')
    const normalized = base || fallback
    return normalized.toLowerCase().endsWith('.json') ? normalized : `${normalized}.json`
}

const readJsonIfExists = (filePath, fallback = {}) => {
    if (!fs.existsSync(filePath)) {
        return fallback
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(raw)
    } catch {
        return fallback
    }
}

const getFolderRemote = (metaRoot, folderSegments) => {
    if (folderSegments.length < 2) return {}
    const folderMetaPath = path.join(metaRoot, ...folderSegments, 'index.json')
    const folderMeta = readJsonIfExists(folderMetaPath, {})
    return folderMeta.remote || folderMeta.remotes?.origin || {}
}

const buildRemoteMapping = (folderSegments, inheritedRemote = {}, currentRemote = {}, id = undefined) => {
    if (folderSegments.length < 2) return null
    const query = { ...(inheritedRemote.query || {}), ...(currentRemote.query || {}) }
    for (const key of Object.keys(query)) {
        if (/^path-\d+$/.test(key)) delete query[key]
    }
    for (let index = 2; index < folderSegments.length; index += 1) {
        query[`path-${index - 1}`] = folderSegments[index]
    }
    return {
        service: currentRemote.service || inheritedRemote.service || folderSegments[0],
        collection: currentRemote.collection || inheritedRemote.collection || folderSegments[1],
        ...(Object.keys(query).length ? { query } : {}),
        ...(id ? { id } : {})
    }
}

const resolveMetaBase = (resolvedTarget, file, withinFolder) => {
    const contentRoot = file.path('$content')
    const specsRoot = file.path('$specs')

    if (withinFolder(contentRoot, resolvedTarget)) {
        return {
            kind: 'content',
            root: contentRoot,
            toMetaRelative: (targetFolder) => path.relative(contentRoot, targetFolder)
        }
    }

    if (withinFolder(specsRoot, resolvedTarget)) {
        return {
            kind: 'specs',
            root: specsRoot,
            toMetaRelative: (targetFolder) => path.join('specs', path.relative(specsRoot, targetFolder))
        }
    }

    return null
}

const getMetaPayload = ({ configFolder, targetPath, requestedMetaFile, resolveApiDirectoryTarget, withinFolder, file, toPosix }) => {
    const resolvedTarget = resolveApiDirectoryTarget(configFolder, targetPath)
    if (!withinFolder(file.path('$cwd'), resolvedTarget) || !fs.existsSync(resolvedTarget)) {
        return { ok: false, error: 'Invalid target path.' }
    }

    const stat = fs.statSync(resolvedTarget)
    const targetType = stat.isDirectory() ? 'directory' : 'file'
    const metaRoot = file.path('$meta')
    const base = resolveMetaBase(resolvedTarget, file, withinFolder)
    if (!base) {
        return { ok: false, error: 'Meta is only available for $content or $specs paths.' }
    }
    const targetFolder = targetType === 'file' ? path.dirname(resolvedTarget) : resolvedTarget
    const relativeFolder = base.toMetaRelative(targetFolder)
    const metaFolder = path.join(metaRoot, relativeFolder === '' ? '' : relativeFolder)
    const defaultMetaFile = targetType === 'file' ? path.basename(resolvedTarget) : 'index.json'

    const selectedMetaFile = normalizeMetaFileName(requestedMetaFile || defaultMetaFile, defaultMetaFile)
    const selectedMetaPath = path.join(metaFolder, selectedMetaFile)
    if (targetType === 'directory' && selectedMetaFile === 'index.json' && !fs.existsSync(selectedMetaPath)) {
        const metaRootAbs = path.resolve(metaRoot)
        const metaFolderAbs = path.resolve(metaFolder)
        if (!withinFolder(metaRootAbs, metaFolderAbs)) {
            return { ok: false, error: 'Invalid meta folder.' }
        }
        fs.mkdirSync(metaFolderAbs, { recursive: true })
        if (!fs.existsSync(selectedMetaPath)) {
            const folderSegments = base.kind === 'content'
                ? relativeFolder.split(path.sep).filter(Boolean)
                : []
            try {
                const parentRemote = folderSegments.length >= 2
                    ? getFolderRemote(metaRoot, folderSegments.slice(0, -1))
                    : {}
                const folderRemote = folderSegments.length >= 2
                    ? buildRemoteMapping(folderSegments, parentRemote, {})
                    : null
                fs.writeFileSync(selectedMetaPath, `${JSON.stringify(folderRemote ? { remote: folderRemote } : {}, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
            } catch (error) {
                if (error.code !== 'EEXIST') throw error
            }
        }
    }
    if (targetType === 'file' && base.kind === 'content' && path.extname(resolvedTarget).toLowerCase() === '.json') {
        const folderSegments = relativeFolder.split(path.sep).filter(Boolean)
        const parentRemote = getFolderRemote(metaRoot, folderSegments)
        const hasFileMeta = fs.existsSync(selectedMetaPath)
        const currentMeta = readJsonIfExists(selectedMetaPath, {})
        const currentRemote = currentMeta.remote || currentMeta.remotes?.origin || {}
        const fileData = readJsonIfExists(resolvedTarget, {})
        const id = fileData?.id || fileData?.code || currentRemote.id || ''
        const hasExistingMapping = Boolean(currentRemote.service && currentRemote.collection)
        const fileMapping = !hasExistingMapping ? buildRemoteMapping(folderSegments, parentRemote, currentRemote, id) : null
        if (fileMapping || (hasExistingMapping && !currentRemote.id && id)) {
            const metaRootAbs = path.resolve(metaRoot)
            const metaFolderAbs = path.resolve(metaFolder)
            if (!withinFolder(metaRootAbs, metaFolderAbs)) {
                return { ok: false, error: 'Invalid meta folder.' }
            }
            fs.mkdirSync(metaFolderAbs, { recursive: true })
            if (fileMapping) {
                currentMeta.remote = fileMapping
                delete currentMeta.remotes
            } else if (currentMeta.remote) {
                currentMeta.remote = { ...currentMeta.remote, id }
            } else if (currentMeta.remotes?.origin) {
                currentMeta.remotes = { ...currentMeta.remotes, origin: { ...currentMeta.remotes.origin, id } }
            }
            fs.writeFileSync(selectedMetaPath, `${JSON.stringify(currentMeta, null, 2)}\n`, hasFileMeta ? 'utf8' : { encoding: 'utf8', flag: 'wx' })
        }
    }
    const availableMetaFiles = fs.existsSync(metaFolder)
        ? fs.readdirSync(metaFolder).filter((name) => name.toLowerCase().endsWith('.json')).sort((a, b) => a.localeCompare(b))
        : []
    const meta = readJsonIfExists(selectedMetaPath, {})
    const endpoint = targetType === 'file' ? resolveEndpointForFile(resolvedTarget) : null
    const endpointSchema = endpoint ? endpointSchemaPath(endpoint.service, endpoint.collection) : null
    const schemaFile = endpoint ? `.oa/schemas/${endpoint.service}.${endpoint.collection}.schema.json` : null
    const schema = endpointSchema && fs.existsSync(endpointSchema) ? readJsonIfExists(endpointSchema, {}) : {}

    return {
        ok: true,
        rootType: base.kind,
        targetPath: toPosix(targetPath),
        targetType,
        targetModifiedAt: stat.mtime.toISOString(),
        metaFolder: toPosix(path.relative(file.path('$cwd'), metaFolder)),
        selectedMetaFile,
        availableMetaFiles,
        meta,
        schema,
        schemaFile,
        schemaEndpoint: endpoint ? `${endpoint.service}/${endpoint.collection}` : null
    }
}

export const handleMetaApi = ({ req, res, port, configFolder, resolveApiDirectoryTarget, withinFolder, file, toPosix, logger }) => {
    if (!(req.url && req.url.startsWith('/api/meta'))) {
        return false
    }

    if (req.method === 'GET') {
        try {
            const query = new URL(req.url, `http://localhost:${port}`).searchParams
            const targetPath = query.get('path') || '$content'
            const metaFile = query.get('metaFile') || ''
            const payload = getMetaPayload({ configFolder, targetPath, requestedMetaFile: metaFile, resolveApiDirectoryTarget, withinFolder, file, toPosix })
            if (!payload.ok) {
                sendJson(res, 400, payload)
                return true
            }
            sendJson(res, 200, payload)
        } catch (error) {
            logger('handlers.serve').error(error)
            sendJson(res, 500, { ok: false, error: 'Unable to load meta.' })
        }
        return true
    }

    if (req.method === 'POST') {
        readJsonBody(req, 300000)
            .then((payload) => {
                const targetPath = String(payload.path || '').trim()
                if (!targetPath) {
                    sendJson(res, 400, { ok: false, error: 'Meta path is required.' })
                    return
                }

                const metaState = getMetaPayload({ configFolder, targetPath, requestedMetaFile: payload.metaFile, resolveApiDirectoryTarget, withinFolder, file, toPosix })
                if (!metaState.ok) {
                    sendJson(res, 400, metaState)
                    return
                }

                const metaRootAbs = file.path('$meta')
                const metaFolderAbs = path.resolve(file.path('$cwd'), metaState.metaFolder)
                if (!withinFolder(metaRootAbs, metaFolderAbs)) {
                    sendJson(res, 400, { ok: false, error: 'Invalid meta folder.' })
                    return
                }

                if (!fs.existsSync(metaFolderAbs)) {
                    fs.mkdirSync(metaFolderAbs, { recursive: true })
                }

                if (Object.prototype.hasOwnProperty.call(payload, 'meta')) {
                    const metaFileName = normalizeMetaFileName(metaState.selectedMetaFile)
                    fs.writeFileSync(path.join(metaFolderAbs, metaFileName), JSON.stringify(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}, null, 2), 'utf8')
                }

                const refreshed = getMetaPayload({ configFolder, targetPath, requestedMetaFile: payload.metaFile, resolveApiDirectoryTarget, withinFolder, file, toPosix })
                sendJson(res, 200, refreshed)
            })
            .catch((error) => {
                logger('handlers.serve').error(error)
                sendJson(res, 400, { ok: false, error: 'Invalid request body.' })
            })
        return true
    }

    return false
}
