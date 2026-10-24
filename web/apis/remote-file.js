import path from 'path'
import fs from 'fs'
import { readJsonBody, sendJson } from './common.js'

const resolveMappedFile = ({ targetPath, configFolder, resolveApiDirectoryTarget, withinFolder, file }) => {
    const resolved = resolveApiDirectoryTarget(configFolder, targetPath)
    const contentRoot = file.path('$content')
    if (!withinFolder(contentRoot, resolved) || !withinFolder(file.path('$cwd'), resolved) || path.extname(resolved).toLowerCase() !== '.json') {
        return { error: 'Remote comparison is available only for JSON files under $content.' }
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return { error: 'The local JSON file does not exist.' }
    if (!withinFolder(fs.realpathSync(contentRoot), fs.realpathSync(resolved))) return { error: 'The local file resolves outside the content folder.' }
    const local = file.parse(resolved)
    let localData
    try {
        localData = JSON.parse(fs.readFileSync(resolved, 'utf8'))
    } catch {
        return { error: 'The local file is not valid JSON.' }
    }
    const record = file.meta(localData?.code || localData?.id, local) || {}
    const remotes = record.remotes || file.meta('remotes', local) || {}
    const legacyRemote = record.remote || file.meta('remote', local)
    let remote = remotes.origin || legacyRemote
    let discovered = false
    if (!remote?.service || !remote?.collection || !remote?.id) {
        const relative = path.relative(contentRoot, resolved).split(path.sep)
        if (relative.length >= 3 && localData && (localData.id || localData.code)) {
            remote = {
                service: relative[0],
                collection: relative[1],
                id: localData.id || localData.code
            }
            discovered = true
        }
    }
    if (!remote?.service || !remote?.collection || !remote?.id) return { error: 'No mapped remote resource was found for this file.' }
    return { resolved, local, remote, remotes, localData, discovered }
}

const readRemote = async (remote, readResource = null) => {
    if (!readResource) readResource = (await import('../../lib/helpers/request.js')).read
    const data = await readResource({ type: 'http', config: remote })
    if (data == null || Array.isArray(data) || typeof data !== 'object') throw new Error('The mapped remote did not return one JSON resource.')
    return { data, content: JSON.stringify(data, null, 2) }
}

const getRemoteVersion = (data) => data?.version || data?.timeStamp || data?.timestamp || data?.updatedAt || data?.modifiedAt || null

const persistRemoteMeta = (file, local, remoteName, mapping, data, baseSnapshot = undefined) => {
    const id = data?.code || data?.id || mapping.id
    const existing = file.meta(id, local) || {}
    const allRemotes = { ...(existing.remotes || {}), [remoteName]: mapping }
    const next = {
        ...existing,
        id: data?.id || data?.code || mapping.id,
        code: data?.code || existing.code,
        name: data?.name || data?.title || existing.name,
        summary: data?.summary || data?.description || existing.summary,
        timestamp: data?.timeStamp ? new Date(data.timeStamp) : new Date(),
        local,
        remotes: allRemotes,
        ...(baseSnapshot ? { baseSnapshot } : {})
    }
    file.meta(id, local, next)
}

export const handleRemoteFileApi = async ({ req, res, port, configFolder, resolveApiDirectoryTarget, withinFolder, file, toPosix, logger, readRemoteResource = null, writeRemoteResource = null }) => {
    if (!(req.url && new URL(req.url, `http://localhost:${port}`).pathname === '/api/remote-file')) return false
    if (req.method !== 'GET' && req.method !== 'POST') return false

    try {
        const payload = req.method === 'POST' ? await readJsonBody(req, 10000000) : null
        const query = new URL(req.url, `http://localhost:${port}`).searchParams
        const targetPath = String(payload?.path || query.get('path') || '').trim()
        if (!targetPath) {
            sendJson(res, 400, { ok: false, error: 'A file path is required.' })
            return true
        }
        const mapped = resolveMappedFile({ targetPath, configFolder, resolveApiDirectoryTarget, withinFolder, file })
        if (mapped.error) {
            sendJson(res, 404, { ok: false, error: mapped.error })
            return true
        }

        if (req.method === 'POST') {
            const action = String(payload?.action || '')
            if (action === 'pull') {
                const { data, content } = await readRemote(mapped.remote, readRemoteResource)
                fs.writeFileSync(mapped.resolved, content, 'utf8')
                const pulledAt = new Date().toISOString()
                persistRemoteMeta(file, mapped.local, 'origin', mapped.remote, data, {
                    content,
                    pulledAt,
                    version: getRemoteVersion(data),
                    remote: { service: mapped.remote.service, collection: mapped.remote.collection, query: mapped.remote.query, id: mapped.remote.id }
                })
                sendJson(res, 200, { ok: true, action, path: toPosix(targetPath), content, pulledAt, version: getRemoteVersion(data) })
                return true
            }
            if (action === 'push') {
                const localData = JSON.parse(fs.readFileSync(mapped.resolved, 'utf8'))
                if (!writeRemoteResource) writeRemoteResource = (await import('../../lib/helpers/request.js')).write
                const updated = await writeRemoteResource({ type: 'http', config: mapped.remote }, localData)
                if (!updated) throw new Error('The remote service did not confirm the full-file push.')
                const nextMapping = {
                    service: mapped.remote.service,
                    collection: mapped.remote.collection,
                    query: mapped.remote.query,
                    id: updated?.id || updated?.code || mapped.remote.id
                }
                persistRemoteMeta(file, mapped.local, 'origin', nextMapping, updated || localData)
                sendJson(res, 200, { ok: true, action, path: toPosix(targetPath), mapping: nextMapping })
                return true
            }
            sendJson(res, 400, { ok: false, error: 'Action must be pull or push.' })
            return true
        }
        const { data, content } = await readRemote(mapped.remote, readRemoteResource)
        sendJson(res, 200, {
            ok: true,
            path: toPosix(targetPath),
            content,
            mapping: { service: mapped.remote.service, collection: mapped.remote.collection, id: mapped.remote.id, discovered: mapped.discovered },
            version: getRemoteVersion(data),
            fetchedAt: new Date().toISOString()
        })
    } catch (error) {
        logger?.('handlers.serve')?.error?.(error)
        sendJson(res, 502, { ok: false, error: error.message || 'Unable to fetch the mapped remote file.' })
    }
    return true
}
