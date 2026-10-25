import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as file from '../helpers/file.js'
import * as request from '../helpers/request.js'
import { settings } from '../helpers/data.js'
import { validateContent } from '../helpers/schema-validation.js'
import * as notifications from '../helpers/notifications.js'
import { dedupePendingTasks, getMonitQueuePath, taskPathKeyForMonitor as taskPathKey } from '../helpers/monit-queue.js'

const serialize = (value) => JSON.stringify(value, null, 2)
const canonical = (text) => {
    try { return JSON.stringify(JSON.parse(text)) } catch { return null }
}
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex')
const now = () => new Date().toISOString()
const relativePath = (target) => path.relative(file.path('$cwd'), target).replace(/\\/g, '/')
const monitUrl = (target = null) => {
    const port = settings.getOrSet('serve.port', 3000)
    const viewerPath = target ? `$content/${path.relative(file.path('$content'), target).replace(/\\/g, '/')}` : '$content'
    return `http://localhost:${port}/#section=data&path=${encodeURIComponent(viewerPath)}&monit=conflicts`
}

const getMetaRecord = (target) => {
    const contentRoot = file.path('$content')
    const folder = path.dirname(target)
    const relativeFolder = path.relative(contentRoot, folder)
    const metadataPath = path.join(file.path('$meta'), relativeFolder, path.basename(target))
    if (!fs.existsSync(metadataPath)) return { metadataPath, record: {} }
    try { return { metadataPath, record: JSON.parse(fs.readFileSync(metadataPath, 'utf8')) } }
    catch { return { metadataPath, record: {} } }
}

const writeMetaRecord = (target, record) => {
    const id = record.id || record.code || path.basename(target, path.extname(target))
    file.meta(id, file.parse(target), record)
}

const appendLog = (target, action, details = {}) => {
    const date = new Date()
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const flatFilePath = relativePath(target)
        .split('/')
        .map((segment) => encodeURIComponent(segment).replace(/_/g, '%5F'))
        .join('__')
    const logFolder = path.join(file.path('$cwd'), '.logs')
    const logPath = path.join(logFolder, `${flatFilePath}.${day}.log`)
    fs.mkdirSync(logFolder, { recursive: true })
    fs.appendFileSync(logPath, `${JSON.stringify({ at: now(), action, file: relativePath(target), ...details })}\n`, 'utf8')
}

const loadQueue = (queuePath) => {
    try { return JSON.parse(fs.readFileSync(queuePath, 'utf8')) }
    catch { return { pending: [] } }
}

const saveQueue = (queuePath, queue) => {
    queue.pending = dedupePendingTasks(queue.pending || [])
    fs.mkdirSync(path.dirname(queuePath), { recursive: true })
    const temporary = `${queuePath}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(queue, null, 2), 'utf8')
    fs.renameSync(temporary, queuePath)
}

const resolveFolderMapping = (folder) => {
    const relative = path.relative(file.path('$content'), folder)
    const segments = relative.split(path.sep).filter(Boolean)
    if (segments.length < 2) return null
    let configured = {}
    for (let depth = 2; depth <= segments.length; depth += 1) {
        const indexPath = path.join(file.path('$meta'), ...segments.slice(0, depth), 'index.json')
        if (!fs.existsSync(indexPath)) continue
        try {
            const folderRecord = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
            configured = { ...configured, ...(folderRecord.remote || folderRecord.remotes?.origin || {}) }
            configured.query = { ...(configured.query || {}), ...((folderRecord.remote || folderRecord.remotes?.origin || {}).query || {}) }
        } catch { return null }
    }
    const query = { ...(configured.query || {}) }
    for (const key of Object.keys(query)) if (/^path-\d+$/.test(key)) delete query[key]
    for (let index = 2; index < segments.length; index += 1) query[`path-${index - 1}`] = segments[index]
    return {
        service: configured.service || segments[0],
        collection: configured.collection || segments[1],
        ...(Object.keys(query).length ? { query } : {})
    }
}

const saveInheritedFileMapping = (target, record, folderMapping, id) => {
    if (!folderMapping || !id) return record
    const existing = getOriginMapping(record) || {}
    const remote = {
        ...folderMapping,
        ...existing,
        query: { ...(folderMapping.query || {}), ...(existing.query || {}) },
        id: existing.id || id
    }
    record.id = record.id || id
    record.remote = remote
    delete record.remotes
    writeMetaRecord(target, record)
    return record
}

const ensurePendingNewFile = (queue, target, mapping, monitorFolder) => {
    const key = path.resolve(target)
    if (queue.pending.some((task) => taskPathKey(task.path) === taskPathKey(key))) return false
    queue.pending = dedupePendingTasks(queue.pending)
    queue.pending.push({
        id: crypto.randomUUID(),
        kind: 'new-file',
        status: 'awaiting-approval',
        path: key,
        relativePath: relativePath(key),
        monitorFolder: relativePath(monitorFolder),
        detectedAt: now(),
        suggestedRemote: mapping,
        message: 'New local files are never pushed automatically. Review metadata and approve explicitly.'
    })
    return true
}

const getOriginMapping = (record) => record.remotes?.origin || record.remote || null

const saveBase = (record, target, remote, text, pushedAt = null) => {
    record.baseSnapshot = {
        content: text,
        pulledAt: pushedAt ? null : now(),
        pushedAt,
        updatedAt: now(),
        remote: { service: remote.service, collection: remote.collection, query: remote.query || {}, id: remote.id }
    }
    if (pushedAt) record.pushedAt = pushedAt
    record.timestamp = now()
    writeMetaRecord(target, record)
}

const markConflict = (target, record, { reason, base, local, remote }) => {
    const signature = digest(`${reason}\0${base || ''}\0${local || ''}\0${remote || ''}`)
    const isNew = record.conflict?.signature !== signature
    if (!isNew && record.conflict?.status === 'unresolved') return
    record.conflict = {
        status: 'unresolved',
        reason,
        signature,
        detectedAt: isNew ? now() : record.conflict.detectedAt,
        baseHash: base == null ? null : digest(base),
        localHash: local == null ? null : digest(local),
        remoteHash: remote == null ? null : digest(remote)
    }
    writeMetaRecord(target, record)
    appendLog(target, 'conflict', { reason, signature })
    notifications.warn(`Remote/local conflict in ${relativePath(target)}. Review conflicts: ${monitUrl(target)}`)
}

const pushNewFile = async (target, mapping, queue, queuePath) => {
    const content = fs.readFileSync(target, 'utf8')
    const validation = await validateContent(target, content)
    if (!validation.valid) {
        appendLog(target, 'push-blocked', { reason: 'schema-validation', schema: validation.schema, schemaFile: validation.schemaFile || null, errors: validation.errors })
        notifications.warn(`Not queued for push: ${relativePath(target)} failed schema validation: ${validation.errors.join('; ')}`)
        return false
    }
    const data = JSON.parse(content)
    const id = data.id || data.code
    if (!id) {
        notifications.warn(`Cannot push ${relativePath(target)}: JSON must include an id or code.`)
        return false
    }
    const createTarget = { type: 'create', config: { ...mapping } }
    if (fs.readFileSync(target, 'utf8') !== content) {
        notifications.warn(`Skipped ${relativePath(target)} because it changed during validation.`)
        return false
    }
    const response = await request.write(createTarget, data)
    if (!response) throw new Error(`Remote create did not complete for ${relativePath(target)}.`)
    const remote = { ...mapping, id: response.id || response.code || id }
    const { record } = getMetaRecord(target)
    const updated = {
        ...record,
        id: response.id || data.id || data.code,
        code: data.code,
        local: { file: path.basename(target) },
        remotes: { ...(record.remotes || {}), origin: remote },
        pushedAt: now(),
        baseSnapshot: { content: serialize(data), pulledAt: null, pushedAt: now(), remote }
    }
    writeMetaRecord(target, updated)
    appendLog(target, 'push-created', { remote, schema: validation.schema, schemaFile: validation.schemaFile })
    queue.pending = queue.pending.filter((task) => task.path !== path.resolve(target))
    saveQueue(queuePath, queue)
    notifications.success(`New file pushed: ${relativePath(target)}`)
    return true
}

const processFile = async (target, { pullDue, pushDue, queue, queuePath }) => {
    const rawLocal = fs.readFileSync(target, 'utf8')
    let localData
    try { localData = JSON.parse(rawLocal) }
    catch (error) {
        appendLog(target, 'monitor-error', { reason: 'invalid-local-json', message: error.message })
        return
    }

    const { record } = getMetaRecord(target)
    const explicitMapping = getOriginMapping(record)
    const folderMapping = resolveFolderMapping(path.dirname(target))
    let mapping = explicitMapping
    if (!mapping && folderMapping && (localData.id || localData.code)) {
        let matches
        try {
            const listing = await request.read({ type: 'http', config: folderMapping })
            matches = Array.isArray(listing) ? listing : Array.isArray(listing?.items) ? listing.items : [listing]
        } catch (error) {
            appendLog(target, 'remote-search-failed', { message: error.message })
            return
        }
        const localIdentity = String(localData.code || localData.id)
        const match = matches.find((item) => item && [item.code, item.id].some((value) => String(value ?? '') === localIdentity))
        if (!match) {
            saveInheritedFileMapping(target, record, folderMapping, localIdentity)
            const added = ensurePendingNewFile(queue, target, folderMapping, path.dirname(target))
            if (added) {
                saveQueue(queuePath, queue)
                notifications.info(`New local file awaits approval: ${relativePath(target)}. Review metadata: ${monitUrl()}`)
            }
            return
        }
        mapping = { ...folderMapping, id: match.id || match.code || localIdentity }
        record.id = record.id || mapping.id
        record.code = record.code || localData.code
        record.remote = mapping
        delete record.remotes
        writeMetaRecord(target, record)
    }
    if (!mapping?.service || !mapping?.collection || !(mapping.id || localData.id || localData.code)) {
        const added = ensurePendingNewFile(queue, target, folderMapping, path.dirname(target))
        if (added) {
            saveQueue(queuePath, queue)
            notifications.info(`New local file awaits approval: ${relativePath(target)}. Review metadata: ${monitUrl()}`)
        }
        return
    }

    const remoteTarget = { type: 'http', config: { ...mapping, id: mapping.id || localData.id || localData.code } }
    let remoteData
    try { remoteData = await request.read(remoteTarget) }
    catch (error) {
        appendLog(target, 'remote-read-failed', { message: error.message })
        return
    }
    if (!remoteData || typeof remoteData !== 'object' || Array.isArray(remoteData)) {
        appendLog(target, 'remote-read-failed', { message: 'Remote resource did not return a JSON object.' })
        return
    }

    const remoteText = serialize(remoteData)
    const localText = serialize(localData)
    const baseText = record.baseSnapshot?.content
    if (typeof baseText !== 'string') {
        // With no prior base, initialize from the remote as requested. Recheck
        // the local bytes so an edit made during the network fetch is not lost.
        const currentLocal = fs.readFileSync(target, 'utf8')
        if (currentLocal !== rawLocal) {
            markConflict(target, record, { reason: 'local-changed-during-baseline-pull', base: null, local: currentLocal, remote: remoteText })
            return
        }
        fs.writeFileSync(target, remoteText, 'utf8')
        saveBase(record, target, remoteTarget.config, remoteText)
        if (record.conflict?.status === 'unresolved') {
            record.conflict = { ...record.conflict, status: 'resolved', resolvedAt: now(), resolution: 'remote-baseline-pulled' }
            writeMetaRecord(target, record)
        }
        appendLog(target, 'pull', { remote: remoteTarget.config, baselineInitialized: true })
        notifications.info(`Pulled remote file and initialized its baseline: ${relativePath(target)}`)
        return
    }

    const localChanged = canonical(localText) !== canonical(baseText)
    const remoteChanged = canonical(remoteText) !== canonical(baseText)
    if (!localChanged && !remoteChanged) {
        if (record.conflict?.status === 'unresolved') {
            record.conflict = { ...record.conflict, status: 'resolved', resolvedAt: now(), resolution: 'contents-converged' }
            writeMetaRecord(target, record)
        }
        return
    }

    if (localChanged && remoteChanged && canonical(localText) === canonical(remoteText)) {
        saveBase(record, target, remoteTarget.config, remoteText)
        if (record.conflict?.status === 'unresolved') record.conflict = { ...record.conflict, status: 'resolved', resolvedAt: now(), resolution: 'contents-converged' }
        writeMetaRecord(target, record)
        appendLog(target, 'converged', { remote: remoteTarget.config })
        return
    }

    if (localChanged && remoteChanged && canonical(localText) !== canonical(remoteText)) {
        markConflict(target, record, { reason: 'both-sides-changed', base: baseText, local: localText, remote: remoteText })
        return
    }

    if (remoteChanged && !localChanged) {
        if (!pullDue) return
        // Optimistic concurrency check: never overwrite edits made while the remote fetch was in flight.
        if (fs.readFileSync(target, 'utf8') !== rawLocal) {
            markConflict(target, record, { reason: 'local-changed-during-pull', base: baseText, local: fs.readFileSync(target, 'utf8'), remote: remoteText })
            return
        }
        fs.writeFileSync(target, remoteText, 'utf8')
        saveBase(record, target, remoteTarget.config, remoteText)
        if (record.conflict?.status === 'unresolved') record.conflict = { ...record.conflict, status: 'resolved', resolvedAt: now(), resolution: 'remote-pulled' }
        writeMetaRecord(target, record)
        appendLog(target, 'pull', { remote: remoteTarget.config })
        notifications.info(`Pulled remote changes: ${relativePath(target)}`)
        return
    }

    if (localChanged && !remoteChanged) {
        const validation = await validateContent(target, rawLocal)
        if (!validation.valid) {
            appendLog(target, 'push-blocked', { reason: 'schema-validation', schema: validation.schema, schemaFile: validation.schemaFile || null, errors: validation.errors })
            return
        }
        const candidateHash = digest(rawLocal)
        const task = { id: `push:${path.resolve(target)}`, kind: 'push', status: 'queued', path: path.resolve(target), relativePath: relativePath(target), queuedAt: now(), contentHash: candidateHash, schema: validation.schema, schemaFile: validation.schemaFile }
        const existing = queue.pending.findIndex((item) => taskPathKey(item.path) === taskPathKey(task.path))
        if (existing >= 0) {
            const previous = queue.pending[existing]
            if (previous.kind === 'new-file' && previous.status === 'awaiting-approval') return
            task.queuedAt = previous.contentHash === candidateHash ? previous.queuedAt : now()
            queue.pending[existing] = task
            if (previous.contentHash !== candidateHash) notifications.info(`Updated queued full-file push: ${relativePath(target)}`)
        } else {
            queue.pending.push(task)
            notifications.info(`Queued full-file push after schema validation: ${relativePath(target)}`)
        }
        saveQueue(queuePath, queue)
        if (!pushDue) return

        // Recheck remote and local immediately before sending; no local file lock is taken.
        const latestRemote = await request.read(remoteTarget)
        const latestRemoteText = serialize(latestRemote)
        if (canonical(latestRemoteText) !== canonical(baseText)) {
            markConflict(target, record, { reason: 'remote-changed-before-push', base: baseText, local: rawLocal, remote: latestRemoteText })
            return
        }
        if (!fs.existsSync(target) || digest(fs.readFileSync(target, 'utf8')) !== candidateHash) {
            appendLog(target, 'push-deferred', { reason: 'local-changed-before-push' })
            return
        }
        const response = await request.write(remoteTarget, JSON.parse(rawLocal))
        if (!response) throw new Error(`Remote update did not complete for ${relativePath(target)}.`)
        saveBase(record, target, remoteTarget.config, serialize(JSON.parse(rawLocal)), now())
        record.conflict = record.conflict?.status === 'unresolved'
            ? { ...record.conflict, status: 'resolved', resolvedAt: now(), resolution: 'local-pushed' }
            : record.conflict
        writeMetaRecord(target, record)
        queue.pending = queue.pending.filter((item) => item.id !== task.id)
        saveQueue(queuePath, queue)
        appendLog(target, 'push', { remote: remoteTarget.config, schema: validation.schema, schemaFile: validation.schemaFile, contentHash: candidateHash })
        notifications.success(`Pushed local changes: ${relativePath(target)}`)
    }
}

const approveFile = async (value, queue, queuePath) => {
    const target = path.resolve(process.env.OA_CWD || process.cwd(), value)
    const task = queue.pending.find((item) => item.kind === 'new-file' && item.path === target)
    if (!task) throw new Error(`No pending new-file task was found for ${value}.`)
    const { record } = getMetaRecord(target)
    const mapping = getOriginMapping(record) || task.suggestedRemote
    if (!mapping?.service || !mapping?.collection) throw new Error(`No remote mapping is available for ${value}; configure its file or folder metadata first.`)
    return pushNewFile(target, mapping, queue, queuePath)
}

const delay = (milliseconds) => new Promise((resolve) => {
    const onStop = () => { clearTimeout(timer); resolve() }
    const timer = setTimeout(() => {
        process.removeListener('SIGINT', onStop)
        resolve()
    }, milliseconds)
    process.once('SIGINT', onStop)
})

export const parse = (args) => ({ folder: args?.[0] })

export const execute = async (options = {}) => {
    if (!options.folder) throw new Error('A folder is required. Usage: oa monit <folder>')
    const folder = file.path(options.folder)
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`Monitor folder does not exist: ${options.folder}`)
    const relativeContentFolder = path.relative(file.path('$content'), folder)
    if (relativeContentFolder === '..' || relativeContentFolder.startsWith(`..${path.sep}`) || path.isAbsolute(relativeContentFolder)) {
        throw new Error('oa monit only supports folders inside the workspace $content directory.')
    }

    const pullMinutes = Number(settings.getOrSet('monit.pullIntervalMinutes', 5))
    const pushMinutes = Number(settings.getOrSet('monit.pushIntervalMinutes', 5))
    if (!Number.isFinite(pullMinutes) || pullMinutes < 1 || !Number.isFinite(pushMinutes) || pushMinutes < 1) {
        throw new Error('monit.pullIntervalMinutes and monit.pushIntervalMinutes must be numbers of at least 1.')
    }

    const queuePath = getMonitQueuePath({ workspaceRoot: file.path('$cwd'), metaRoot: file.path('$meta') })
    const queue = loadQueue(queuePath)
    queue.pending = dedupePendingTasks(queue.pending || [])
    if (options.approve) {
        const approved = await approveFile(options.approve, queue, queuePath)
        if (!approved) throw new Error(`The file was not pushed: ${options.approve}`)
        return
    }

    if (options.flush) {
        const prefix = `${taskPathKey(folder)}${path.sep}`
        const tasks = queue.pending.filter((task) => (task.kind === 'push' && task.status === 'queued'
            || task.kind === 'new-file' && task.status === 'awaiting-approval')
            && taskPathKey(task.path).startsWith(prefix))
        if (!tasks.length) return { processed: 0, message: 'There are no tasks ready to flush.' }
        let processed = 0
        let failed = 0
        for (const task of tasks) {
            const latest = loadQueue(queuePath)
            const currentTask = (latest.pending || []).find((item) => taskPathKey(item.path) === taskPathKey(task.path))
            if (!currentTask || !((currentTask.kind === 'push' && currentTask.status === 'queued')
                || (currentTask.kind === 'new-file' && currentTask.status === 'awaiting-approval'))) continue
            const taskKind = currentTask.kind
            latest.pending = dedupePendingTasks(latest.pending || [])
            latest.pending = latest.pending.map((item) => taskPathKey(item.path) === taskPathKey(task.path) ? { ...item, status: 'processing', startedAt: now() } : item)
            saveQueue(queuePath, latest)
            queue.pending = latest.pending
            try {
                if (taskKind === 'new-file') await approveFile(task.relativePath, queue, queuePath)
                else await processFile(task.path, { pullDue: false, pushDue: true, queue, queuePath })
                const after = loadQueue(queuePath)
                after.pending = (after.pending || []).map((item) => taskPathKey(item.path) === taskPathKey(task.path) && item.status === 'processing'
                    ? { ...item, status: taskKind === 'new-file' ? 'awaiting-approval' : 'queued', startedAt: undefined }
                    : item)
                saveQueue(queuePath, after)
                if (!(after.pending || []).some((item) => taskPathKey(item.path) === taskPathKey(task.path))) processed += 1
            } catch (error) {
                const after = loadQueue(queuePath)
                after.pending = (after.pending || []).map((item) => taskPathKey(item.path) === taskPathKey(task.path)
                    ? { ...item, status: taskKind === 'new-file' ? 'awaiting-approval' : 'failed', error: error.message, failedAt: now() }
                    : item)
                saveQueue(queuePath, after)
                failed += 1
            }
        }
        const remainingPaths = new Set(loadQueue(queuePath).pending.map((item) => taskPathKey(item.path)))
        const remaining = tasks.filter((task) => remainingPaths.has(taskPathKey(task.path))).length
        return {
            processed,
            failed,
            remaining,
            message: `${processed} file${processed === 1 ? '' : 's'} pushed${failed ? `; ${failed} task${failed === 1 ? '' : 's'} failed` : ''}${remaining ? `; ${remaining} task${remaining === 1 ? '' : 's'} remain queued` : ''}.`
        }
    }

    notifications.info(`Monitoring ${folder} (pull every ${pullMinutes} min; push every ${pushMinutes} min). Press Ctrl+C to stop.`)
    let nextPull = 0
    let nextPush = 0
    let running = true
    const startedAt = now()
    queue.status = {
        folder: relativePath(folder),
        pid: process.pid,
        running: true,
        startedAt,
        heartbeatAt: startedAt,
        lastRunAt: queue.status?.lastRunAt || null,
        pullIntervalMinutes: pullMinutes,
        pushIntervalMinutes: pushMinutes,
        nextPullAt: new Date().toISOString(),
        nextPushAt: new Date().toISOString()
    }
    process.once('SIGINT', () => { running = false; notifications.info('Stopping oa monit after the current file operation.') })

    while (running) {
        queue.pending = dedupePendingTasks(loadQueue(queuePath).pending || [])
        const pendingIdsAtScanStart = new Set(queue.pending.map((item) => item.id))
        const current = Date.now()
        const pullDue = current >= nextPull
        const pushDue = current >= nextPush
        if (pullDue) nextPull = current + pullMinutes * 60_000
        if (pushDue) nextPush = current + pushMinutes * 60_000
        queue.status.nextPullAt = new Date(nextPull).toISOString()
        queue.status.nextPushAt = new Date(nextPush).toISOString()
        queue.status.heartbeatAt = now()
        saveQueue(queuePath, queue)

        const files = file.find({ folder }, {
            exclude: { folders: ['.oa', '.logs', '.cache', 'scripts'] },
            include: { files: ['.json'] }
        })
        for (const target of files) {
            if (!running) break
            if (loadQueue(queuePath).pending.some((task) => taskPathKey(task.path) === taskPathKey(target) && task.status === 'processing')) continue
            try { await processFile(target, { pullDue, pushDue, queue, queuePath }) }
            catch (error) {
                appendLog(target, 'monitor-error', { message: error.message })
                notifications.error(error)
            }
        }
        queue.status.lastRunAt = now()
        queue.status.heartbeatAt = now()
        if (!running) {
            queue.status.running = false
            queue.status.stoppedAt = now()
        }
        const latestPending = loadQueue(queuePath).pending || []
        const pendingIdsInMemory = new Set(queue.pending.map((item) => item.id))
        const mergedPending = latestPending.filter((item) => !pendingIdsAtScanStart.has(item.id) || pendingIdsInMemory.has(item.id))
        const mergedIds = new Set(mergedPending.map((item) => item.id))
        for (const item of queue.pending) {
            if (!pendingIdsAtScanStart.has(item.id) && !mergedIds.has(item.id)) {
                mergedPending.push(item)
                mergedIds.add(item.id)
            }
        }
        queue.pending = mergedPending
        saveQueue(queuePath, queue)
        if (!running) break
        const waitUntil = Math.min(nextPull, nextPush)
        await delay(Math.max(1, waitUntil - Date.now()))
    }
}
