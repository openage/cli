import fs from 'fs'
import path from 'path'
import { readJsonBody, sendJson } from './common.js'

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

const getSchemasIndexPath = (file) => file.path('$oa/schemas/index.json')

const readSchemasIndex = (file) => {
    const schemasPath = getSchemasIndexPath(file)
    const parsed = readJsonIfExists(schemasPath, {})
    return {
        path: schemasPath,
        data: {
            items: Array.isArray(parsed.items) ? parsed.items : [],
            mappings: parsed.mappings && typeof parsed.mappings === 'object' ? parsed.mappings : {}
        }
    }
}

const writeSchemasIndex = (file, data) => {
    const schemasPath = getSchemasIndexPath(file)
    fs.mkdirSync(path.dirname(schemasPath), { recursive: true })
    fs.writeFileSync(schemasPath, JSON.stringify(data, null, 2), 'utf8')
}

const normalizeSchemaOptions = (items) => {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            if (typeof item === 'string') {
                return { value: item, label: item }
            }
            if (item && typeof item === 'object') {
                const value = String(item.code || item.type || item.id || item.value || '').trim()
                if (!value) return null
                const label = String(item.name || item.title || item.label || value).trim()
                return { value, label }
            }
            return null
        })
        .filter(Boolean)
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
    const defaultMetaFile = targetType === 'file' ? path.basename(resolvedTarget) : 'meta.json'

    const availableMetaFiles = fs.existsSync(metaFolder)
        ? fs.readdirSync(metaFolder).filter((name) => name.toLowerCase().endsWith('.json')).sort((a, b) => a.localeCompare(b))
        : []

    const selectedMetaFile = normalizeMetaFileName(requestedMetaFile || defaultMetaFile, defaultMetaFile)
    const selectedMetaPath = path.join(metaFolder, selectedMetaFile)
    const meta = readJsonIfExists(selectedMetaPath, {})
    const schemaPath = path.join(metaFolder, 'schema.json')
    const schema = readJsonIfExists(schemaPath, {})
    const schemasIndex = readSchemasIndex(file).data
    const schemaOptions = normalizeSchemaOptions(schemasIndex.items)
    const mappingKey = toPosix(targetPath)
    const mappedSchemaType = String(schemasIndex.mappings?.[mappingKey] || '').trim()
    const schemaType = mappedSchemaType || String(schema?.type ?? schema?.code ?? schema?.schema ?? '')

    return {
        ok: true,
        rootType: base.kind,
        targetPath: toPosix(targetPath),
        targetType,
        metaFolder: toPosix(path.relative(file.path('$cwd'), metaFolder)),
        selectedMetaFile,
        availableMetaFiles,
        meta,
        schema,
        mappedSchemaType,
        schemaOptions,
        schemaType: String(schemaType || '')
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

                if (Object.prototype.hasOwnProperty.call(payload, 'schemaType')) {
                    const nextType = String(payload.schemaType || '').trim()
                    const schemasIndex = readSchemasIndex(file).data
                    const mappingKey = toPosix(targetPath)
                    if (nextType) schemasIndex.mappings[mappingKey] = nextType
                    else delete schemasIndex.mappings[mappingKey]
                    writeSchemasIndex(file, schemasIndex)
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
