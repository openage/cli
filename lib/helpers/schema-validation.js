import fs from 'fs'
import path from 'path'
import * as file from './file.js'
import * as context from '../../src/providers/context.js'

const safePart = (value) => /^[a-zA-Z0-9_-]+$/.test(String(value || ''))

export const resolveEndpointForFile = (targetPath, endpointOverride = null) => {
    if (endpointOverride?.service && endpointOverride?.collection) return { service: endpointOverride.service, collection: endpointOverride.collection }
    let absolute = path.resolve(targetPath)
    let data = {}
    try { data = JSON.parse(fs.readFileSync(absolute, 'utf8')) } catch {}
    const local = file.parse(absolute)
    const record = file.meta(data?.code || data?.id, local) || {}
    const mapping = record.remotes?.origin || record.remote || file.meta('remote', local) || {}
    if (mapping.service && mapping.collection) return { service: mapping.service, collection: mapping.collection }
    const contentRoot = context.paths('$content')
    const relative = path.relative(contentRoot, absolute).split(path.sep)
    if (!relative[0] || relative[0] === '..' || relative.length < 3) return null
    return { service: relative[0], collection: relative[1] }
}

export const endpointSchemaPath = (service, collection) => {
    if (!safePart(service) || !safePart(collection)) return null
    return file.path({ folder: '$oa/schemas', file: `${service}.${collection}.schema.json` })
}

export const validateContent = async (targetPath, content, endpointOverride = null) => {
    let data
    try { data = JSON.parse(content) } catch (error) {
        return { valid: false, schema: null, schemaFile: null, errors: [`Invalid JSON: ${error.message}`] }
    }
    const endpoint = resolveEndpointForFile(targetPath, endpointOverride)
    if (!endpoint) return { valid: false, schema: null, schemaFile: null, errors: [`Unable to determine endpoint for ${targetPath}.`] }
    const schemaPath = endpointSchemaPath(endpoint.service, endpoint.collection)
    const schemaFile = `.oa/schemas/${endpoint.service}.${endpoint.collection}.schema.json`
    const schemaName = `${endpoint.service}.${endpoint.collection}`
    if (!schemaPath || !fs.existsSync(schemaPath)) {
        return { valid: false, schema: schemaName, schemaFile, errors: [`Endpoint schema not found: ${schemaFile}.`] }
    }
    try {
        const Ajv2020 = (await import('ajv/dist/2020.js')).default
        const ajv = new Ajv2020({ allErrors: true, strict: false })
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
        for (const name of fs.readdirSync(path.dirname(schemaPath))) {
            if (!name.endsWith('.schema.json') || name === path.basename(schemaPath)) continue
            try { ajv.addSchema(JSON.parse(fs.readFileSync(path.join(path.dirname(schemaPath), name), 'utf8')), name) } catch {}
        }
        const validate = ajv.compile(schema)
        const valid = validate(data)
        return {
            valid, schema: schemaName, schemaFile,
            errors: valid ? [] : (validate.errors || []).map((error) => `${error.instancePath || '(root)'} ${error.message || 'is invalid'}`)
        }
    } catch (error) {
        return { valid: false, schema: schemaName, schemaFile, errors: [`Unable to validate against '${schemaFile}': ${error.message}`] }
    }
}
