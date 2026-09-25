import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'

const makeReq = (url, method = 'GET', payload = null) => {
    const req = new EventEmitter()
    req.url = url
    req.method = method
    if (payload !== null) {
        process.nextTick(() => {
            req.emit('data', Buffer.from(JSON.stringify(payload)))
            req.emit('end')
        })
    }
    return req
}

const makeRes = () => {
    const res = {
        statusCode: null,
        headers: null,
        body: '',
        writeHead(statusCode, headers) {
            this.statusCode = statusCode
            this.headers = headers
        },
        end(payload) {
            this.body = payload
        }
    }
    return res
}

test('file API can read and write data files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-file-api-'))
    const contentRoot = path.join(tempDir, 'content')
    fs.mkdirSync(contentRoot, { recursive: true })

    const fileApi = await import('../web/apis/file.js')
    const file = {
        path: (value) => {
            if (value === '$cwd') return tempDir
            if (value === '$content') return contentRoot
            if (value.startsWith('$content/')) return path.join(contentRoot, value.slice('$content/'.length))
            return path.join(tempDir, value)
        }
    }
    const withinFolder = (base, candidate) => {
        const rel = path.relative(base, candidate)
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
    }

    const targetPath = '$content/example.json'
    const sample = { hello: 'world' }
    const writeReq = makeReq('http://localhost:3000/api/file', 'POST', { path: targetPath, content: JSON.stringify(sample, null, 2) })
    const writeRes = makeRes()

    const handled = fileApi.handleFileApi({
        req: writeReq,
        res: writeRes,
        configFolder: tempDir,
        resolveApiDirectoryTarget: (configFolder, subPath) => (String(subPath || '').trim().startsWith('$') ? file.path(subPath) : path.join(configFolder, subPath)),
        withinFolder,
        file,
        toPosix: (value = '') => value.replaceAll('\\', '/'),
        logger: () => { }
    })

    assert.equal(handled, true)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(writeRes.statusCode, 200)
    assert.equal(fs.readFileSync(path.join(contentRoot, 'example.json'), 'utf8'), JSON.stringify(sample, null, 2))

    const readReq = makeReq('http://localhost:3000/api/file?path=$content/example.json', 'GET')
    const readRes = makeRes()

    const readHandled = fileApi.handleFileApi({
        req: readReq,
        res: readRes,
        configFolder: tempDir,
        resolveApiDirectoryTarget: (configFolder, subPath) => (String(subPath || '').trim().startsWith('$') ? file.path(subPath) : path.join(configFolder, subPath)),
        withinFolder,
        file,
        toPosix: (value = '') => value.replaceAll('\\', '/'),
        logger: () => { }
    })

    assert.equal(readHandled, true)
    assert.equal(readRes.statusCode, 200)
    const payload = JSON.parse(readRes.body)
    assert.equal(payload.ok, true)
    assert.equal(payload.content, JSON.stringify(sample, null, 2))
})
