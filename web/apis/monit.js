import fs from 'fs'
import path from 'path'
import { readJsonBody, sendJson } from './common.js'
import { dedupePendingTasks, getMonitQueuePath } from '../../lib/helpers/monit-queue.js'

const walk = (folder, output = []) => {
    if (!fs.existsSync(folder)) return output
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const target = path.join(folder, entry.name)
        if (entry.isDirectory()) walk(target, output)
        else if (entry.name.toLowerCase().endsWith('.json') && !['index.json', 'schema.json'].includes(entry.name.toLowerCase())) output.push(target)
    }
    return output
}

export const handleMonitApi = ({ req, res, port, file, approveTask = null, flushTasks = null }) => {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
    if (requestUrl.pathname !== '/api/monit') return false
    const contentRoot = file.path('$content')
    const metaRoot = file.path('$meta')
    const queuePath = getMonitQueuePath({ workspaceRoot: file.path('$cwd'), metaRoot })
    if (req.method === 'POST') {
        readJsonBody(req, 100000)
            .then(async (payload) => {
                if (!['approve', 'flush'].includes(payload.action)) {
                    sendJson(res, 400, { ok: false, error: 'Action must be approve or flush.' })
                    return
                }
                let queue
                try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')) }
                catch {
                    sendJson(res, 404, { ok: false, error: 'The monitor queue is unavailable.' })
                    return
                }
                if (payload.action === 'flush') {
                    const folder = String(queue.status?.folder || '').trim()
                    if (!folder) {
                        sendJson(res, 409, { ok: false, error: 'No monitored folder is recorded. Start oa monit with a folder first.' })
                        return
                    }
                    try {
                        const result = flushTasks
                            ? await flushTasks({ folder })
                            : await (await import('../../lib/handlers/monit.js')).execute({ folder, flush: true })
                        sendJson(res, 200, { ok: true, action: 'flush', ...(result || {}) })
                    } catch (error) {
                        sendJson(res, 502, { ok: false, error: error.message || 'Unable to flush ready tasks.' })
                    }
                    return
                }
                const requestedPath = String(payload.path || '').trim()
                if (!requestedPath) {
                    sendJson(res, 400, { ok: false, error: 'A queued file path is required.' })
                    return
                }
                const targetPath = path.resolve(file.path('$cwd'), requestedPath)
                const task = (Array.isArray(queue.pending) ? queue.pending : []).find((item) => item.kind === 'new-file'
                    && item.status === 'awaiting-approval'
                    && path.resolve(item.path) === targetPath)
                if (!task) {
                    sendJson(res, 404, { ok: false, error: 'This file is no longer awaiting approval. Refresh the Monitor page.' })
                    return
                }
                const isWithin = (base, candidate) => {
                    const relative = path.relative(base, candidate)
                    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
                }
                const monitorFolder = path.resolve(file.path('$cwd'), task.monitorFolder || '')
                if (!isWithin(contentRoot, targetPath) || !isWithin(contentRoot, monitorFolder)
                    || !fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()
                    || !fs.existsSync(monitorFolder) || !fs.statSync(monitorFolder).isDirectory()) {
                    sendJson(res, 400, { ok: false, error: 'The queued file or monitored folder is no longer valid.' })
                    return
                }
                try {
                    if (approveTask) await approveTask({ folder: task.monitorFolder, path: task.relativePath })
                    else {
                        const { execute } = await import('../../lib/handlers/monit.js')
                        await execute({ folder: task.monitorFolder, approve: task.relativePath })
                    }
                    sendJson(res, 200, { ok: true, action: 'approve', path: task.relativePath })
                } catch (error) {
                    sendJson(res, 502, { ok: false, error: error.message || 'Unable to approve the queued file.' })
                }
            })
            .catch((error) => sendJson(res, 400, { ok: false, error: error.message || 'Invalid approval request.' }))
        return true
    }
    if (req.method !== 'GET') return false
    const conflicts = walk(metaRoot).flatMap((metadataPath) => {
        try {
            const record = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
            if (record.conflict?.status !== 'unresolved') return []
            const relativeMetaPath = path.relative(metaRoot, metadataPath)
            const localPath = path.join(contentRoot, relativeMetaPath)
            return [{
                path: localPath,
                contentPath: `$content/${path.relative(contentRoot, localPath).replace(/\\/g, '/')}`,
                relativePath: path.relative(file.path('$cwd'), localPath).replace(/\\/g, '/'),
                reason: record.conflict.reason,
                detectedAt: record.conflict.detectedAt,
                signature: record.conflict.signature
            }]
        } catch { return [] }
    })
    let pending = []
    let status = null
    try {
        const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'))
        pending = dedupePendingTasks(Array.isArray(queue.pending) ? queue.pending : []).map((item) => {
            const target = path.resolve(item.path || '')
            const relative = path.relative(contentRoot, target)
            if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return item
            const metadataPath = path.join(metaRoot, relative)
            try {
                const record = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
                const mapping = record.remotes?.origin || record.remote
                if (mapping?.service && mapping?.collection) return { ...item, suggestedRemote: mapping }
            } catch { /* use the queued mapping when the file has no readable metadata */ }
            return item
        })
        status = queue.status || null
    } catch { /* no queue state yet */ }
    if (status) {
        let processAlive = false
        if (Number.isInteger(Number(status.pid))) {
            try { process.kill(Number(status.pid), 0); processAlive = true } catch { processAlive = false }
        }
        const heartbeat = Date.parse(status.heartbeatAt || '')
        const allowedStaleness = Math.max(Number(status.pullIntervalMinutes) || 5, Number(status.pushIntervalMinutes) || 5) * 120000 + 120000
        status = {
            ...status,
            active: Boolean(status.running && processAlive && Number.isFinite(heartbeat) && Date.now() - heartbeat <= allowedStaleness),
            nextRunAt: [status.nextPullAt, status.nextPushAt].filter(Boolean).sort()[0] || null
        }
    }
    sendJson(res, 200, { ok: true, conflicts, pending, status })
    return true
}
