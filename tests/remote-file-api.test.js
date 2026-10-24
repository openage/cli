import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { handleRemoteFileApi } from '../web/apis/remote-file.js'

const makeRequest = (url, method = 'GET', payload = null) => {
    const req = new EventEmitter()
    req.url = url
    req.method = method
    if (payload) process.nextTick(() => { req.emit('data', Buffer.from(JSON.stringify(payload))); req.emit('end') })
    return req
}

const makeResponse = () => ({
    statusCode: 0,
    body: '',
    writeHead(code) { this.statusCode = code },
    end(body) { this.body = body }
})

const fixture = async (localText = '{\n  "code": "sample"\n}', { mappingEnabled = true, nested = false } = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-remote-file-'))
    const content = path.join(root, 'content')
    const targetFolder = nested ? path.join(content, 'system', 'applications') : content
    fs.mkdirSync(targetFolder, { recursive: true })
    const target = path.join(targetFolder, 'sample.json')
    fs.writeFileSync(target, localText, 'utf8')
    const metadata = new Map()
    const mapping = { service: 'api', collection: 'items', id: 'remote-1', query: {} }
    const file = {
        path(value) {
            if (value === '$cwd') return root
            if (value === '$content') return content
            return value
        },
        parse(value) { return value },
        meta(key, local, data) {
            const recordKey = `${local}:${key}`
            if (data) { metadata.set(recordKey, data); return data }
            if (key === 'remotes') return mappingEnabled ? { origin: mapping } : {}
            if (key === 'remote') return null
            return metadata.get(recordKey) || {}
        }
    }
    const withinFolder = (base, candidate) => {
        const relative = path.relative(base, candidate)
        return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    }
    const common = {
        port: 3000,
        configFolder: root,
        resolveApiDirectoryTarget: (base, value) => path.resolve(value.startsWith('$content/') ? path.join(content, value.slice('$content/'.length)) : path.join(base, value)),
        withinFolder,
        file,
        toPosix: (value) => value.replaceAll('\\', '/'),
        logger: () => ({ error() {} })
    }
    return { root, target, mapping, metadata, common }
}

test('remote-file GET fetches mapped JSON without changing local contents', async () => {
    const data = { code: 'sample', label: 'Remote' }
    const state = await fixture()
    const before = fs.readFileSync(state.target, 'utf8')
    const res = makeResponse()
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file?path=%24content%2Fsample.json'),
        res,
        readRemoteResource: async ({ config }) => { assert.equal(config.id, 'remote-1'); return data }
    })
    const payload = JSON.parse(res.body)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.content, JSON.stringify(data, null, 2))
    assert.equal(fs.readFileSync(state.target, 'utf8'), before)
})

test('remote-file GET discovers service and collection from the content path', async () => {
    const state = await fixture('{\n  "code": "sample"\n}', { mappingEnabled: false, nested: true })
    const res = makeResponse()
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file?path=%24content%2Fsystem%2Fapplications%2Fsample.json'),
        res,
        readRemoteResource: async ({ config }) => {
            assert.deepEqual(config, { service: 'system', collection: 'applications', id: 'sample' })
            return { code: 'sample', label: 'Found by path' }
        }
    })
    const payload = JSON.parse(res.body)
    assert.equal(res.statusCode, 200)
    assert.equal(payload.mapping.discovered, true)
})

test('full pull writes remote text and records the exact merge base after the write', async () => {
    const data = { code: 'sample', value: 2 }
    const state = await fixture()
    const res = makeResponse()
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file', 'POST', { action: 'pull', path: '$content/sample.json' }),
        res,
        readRemoteResource: async () => data
    })
    const content = JSON.stringify(data, null, 2)
    assert.equal(res.statusCode, 200)
    assert.equal(fs.readFileSync(state.target, 'utf8'), content)
    const metadata = state.metadata.get(`${state.target}:sample`)
    assert.equal(metadata.baseSnapshot.content, content)
    assert.equal(metadata.baseSnapshot.remote.id, 'remote-1')
    assert.ok(metadata.baseSnapshot.pulledAt)
})

test('failed pull leaves both local file and prior merge base untouched', async () => {
    const state = await fixture()
    const original = fs.readFileSync(state.target, 'utf8')
    const oldBase = { content: 'previous remote', pulledAt: '2025-01-01T00:00:00.000Z' }
    state.metadata.set(`${state.target}:sample`, { code: 'sample', remotes: { origin: state.mapping }, baseSnapshot: oldBase })
    const res = makeResponse()
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file', 'POST', { action: 'pull', path: '$content/sample.json' }),
        res,
        readRemoteResource: async () => { throw new Error('remote unavailable') }
    })
    assert.equal(res.statusCode, 502)
    assert.equal(fs.readFileSync(state.target, 'utf8'), original)
    assert.deepEqual(state.metadata.get(`${state.target}:sample`).baseSnapshot, oldBase)
})

test('full push sends the complete local JSON file and rejects paths outside content', async () => {
    const state = await fixture('{\n  "code": "sample",\n  "value": 9\n}')
    const res = makeResponse()
    let sent
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file', 'POST', { action: 'push', path: '$content/sample.json' }),
        res,
        writeRemoteResource: async (_remote, payload) => { sent = payload; return { ...payload, id: 'remote-1' } }
    })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(sent, { code: 'sample', value: 9 })

    const unsafe = makeResponse()
    await handleRemoteFileApi({
        ...state.common,
        req: makeRequest('http://localhost:3000/api/remote-file', 'POST', { action: 'pull', path: '$content/../outside.json' }),
        res: unsafe,
        readRemoteResource: async () => { throw new Error('must not fetch') }
    })
    assert.equal(unsafe.statusCode, 404)
})
