import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { handleMonitApi } from '../web/apis/monit.js'

const response = () => ({ statusCode: 0, body: '', writeHead(code) { this.statusCode = code }, end(body) { this.body = body } })

test('monitor API returns queued tasks and live schedule state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-monit-api-'))
    const meta = path.join(root, '.oa', 'meta')
    const queueFolder = path.join(meta, '.monit')
    fs.mkdirSync(queueFolder, { recursive: true })
    const schedule = {
        folder: 'data/system/items', pid: process.pid, running: true,
        heartbeatAt: new Date().toISOString(), lastRunAt: '2026-10-24T10:00:00.000Z',
        nextPullAt: '2026-10-24T10:05:00.000Z', nextPushAt: '2026-10-24T10:05:00.000Z',
        pullIntervalMinutes: 5, pushIntervalMinutes: 5
    }
    const task = { id: 'push:one', kind: 'push', status: 'queued', relativePath: 'data/system/items/a.json' }
    fs.writeFileSync(path.join(queueFolder, 'pending.json'), JSON.stringify({ pending: [task], status: schedule }))
    const res = response()
    const handled = handleMonitApi({
        req: { url: '/api/monit', method: 'GET' }, res, port: 8080,
        file: { path(key) { return key === '$meta' ? meta : key === '$content' ? path.join(root, 'data') : root } }
    })
    assert.equal(handled, true)
    assert.equal(res.statusCode, 200)
    const payload = JSON.parse(res.body)
    assert.deepEqual(payload.pending, [task])
    assert.equal(payload.status.active, true)
    assert.equal(payload.status.lastRunAt, schedule.lastRunAt)
    assert.equal(payload.status.nextRunAt, schedule.nextPullAt)
    fs.rmSync(root, { recursive: true, force: true })
})

test('monitor API approves only queued new files awaiting approval', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-monit-approve-'))
    const contentRoot = path.join(root, 'data')
    const folder = path.join(contentRoot, 'system', 'items')
    const meta = path.join(root, '.oa', 'meta')
    const queueFolder = path.join(meta, '.monit')
    fs.mkdirSync(folder, { recursive: true })
    fs.mkdirSync(queueFolder, { recursive: true })
    const target = path.join(folder, 'new.json')
    fs.writeFileSync(target, '{"id":"new"}', 'utf8')
    const task = {
        id: 'new-file:one', kind: 'new-file', status: 'awaiting-approval',
        path: target, relativePath: 'data/system/items/new.json',
        monitorFolder: 'data/system/items', suggestedRemote: { service: 'system', collection: 'items' }
    }
    fs.writeFileSync(path.join(queueFolder, 'pending.json'), JSON.stringify({ pending: [task] }))
    const file = { path(key) { return ({ '$cwd': root, '$content': contentRoot, '$meta': meta })[key] } }
    const req = new EventEmitter()
    req.url = '/api/monit'
    req.method = 'POST'
    const res = response()
    const completed = new Promise((resolve) => { res.end = (body) => { res.body = body; resolve() } })
    let approved = null
    process.nextTick(() => {
        req.emit('data', Buffer.from(JSON.stringify({ action: 'approve', path: task.relativePath })))
        req.emit('end')
    })
    assert.equal(handleMonitApi({ req, res, port: 8080, file, approveTask: async (details) => { approved = details } }), true)
    await completed
    assert.equal(res.statusCode, 200)
    assert.deepEqual(JSON.parse(res.body), { ok: true, action: 'approve', path: task.relativePath })
    assert.deepEqual(approved, { folder: task.monitorFolder, path: task.relativePath })
    fs.rmSync(root, { recursive: true, force: true })
})

