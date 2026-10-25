import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

test('schema validation resolves endpoint schema by service and collection', async () => {
    const previousCwd = process.env.OA_CWD
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'oa-endpoint-schema-'))
    const contentFolder = path.join(workspace, 'data', 'system', 'items')
    const schemaFolder = path.join(workspace, '.oa', 'schemas')
    fs.mkdirSync(contentFolder, { recursive: true })
    fs.mkdirSync(schemaFolder, { recursive: true })
    fs.writeFileSync(path.join(schemaFolder, 'system.items.schema.json'), JSON.stringify({
        type: 'object', required: ['id'], properties: { id: { type: 'string' } }, additionalProperties: false
    }), 'utf8')
    const target = path.join(contentFolder, 'example.json')
    fs.writeFileSync(target, JSON.stringify({ id: 'example' }), 'utf8')

    try {
        process.env.OA_CWD = workspace
        await import('../lib/helpers/data.js')
        const { validateContent } = await import('../lib/helpers/schema-validation.js')
        const valid = await validateContent(target, fs.readFileSync(target, 'utf8'))
        assert.equal(valid.valid, true)
        assert.equal(valid.schema, 'system.items')
        assert.equal(valid.schemaFile, '.oa/schemas/system.items.schema.json')
        const invalid = await validateContent(target, JSON.stringify({ id: 3 }))
        assert.equal(invalid.valid, false)
        assert.equal(invalid.schemaFile, '.oa/schemas/system.items.schema.json')
        assert.ok(invalid.errors.length > 0)
    } finally {
        if (previousCwd === undefined) delete process.env.OA_CWD
        else process.env.OA_CWD = previousCwd
        fs.rmSync(workspace, { recursive: true, force: true })
    }
})
