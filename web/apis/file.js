import fs from 'fs'
import path from 'path'
import { readJsonBody, sendJson } from './common.js'

const resolveRequestedFile = ({ configFolder, resolveApiDirectoryTarget, file, targetPath, withinFolder }) => {
    const resolvedTarget = resolveApiDirectoryTarget(configFolder, targetPath)
    if (!withinFolder(file.path('$cwd'), resolvedTarget) || !fs.existsSync(resolvedTarget)) {
        return { ok: false, error: 'Invalid file path.' }
    }

    const stat = fs.statSync(resolvedTarget)
    if (stat.isDirectory()) {
        return { ok: false, error: 'A directory cannot be edited as a file.' }
    }

    return { ok: true, resolvedTarget }
}

export const handleFileApi = ({ req, res, configFolder, resolveApiDirectoryTarget, withinFolder, file, toPosix, logger }) => {
    if (!(req.url && typeof req.url === 'string')) {
        return false
    }

    const requestUrl = new URL(req.url, 'http://localhost')
    if (!requestUrl.pathname.startsWith('/api/file')) {
        return false
    }

    if (requestUrl.pathname === '/api/file/create' && req.method === 'POST') {
        readJsonBody(req, 1000000)
            .then((payload) => {
                const directoryPath = String(payload.directory || '').trim()
                const name = String(payload.name || '').trim()
                const hasControlCharacter = [...name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
                if (!directoryPath || !name || name !== path.basename(name) || /[<>:"/\\|?*]/.test(name) || hasControlCharacter || name === '.' || name === '..') {
                    sendJson(res, 400, { ok: false, error: 'Enter a valid file name and folder.' })
                    return
                }

                const resolvedDirectory = resolveApiDirectoryTarget(configFolder, directoryPath)
                if (!withinFolder(file.path('$cwd'), resolvedDirectory) || !fs.existsSync(resolvedDirectory) || !fs.statSync(resolvedDirectory).isDirectory()) {
                    sendJson(res, 400, { ok: false, error: 'The selected folder is invalid.' })
                    return
                }
                const realDirectory = fs.realpathSync(resolvedDirectory)
                if (!withinFolder(fs.realpathSync(file.path('$cwd')), realDirectory)) {
                    sendJson(res, 400, { ok: false, error: 'The selected folder resolves outside the workspace.' })
                    return
                }

                const targetPath = path.join(resolvedDirectory, name)
                const content = path.extname(name).toLowerCase() === '.json' ? '{}\n' : ''
                let descriptor
                try {
                    descriptor = fs.openSync(targetPath, 'wx')
                    fs.writeFileSync(descriptor, content, 'utf8')
                } catch (error) {
                    if (error.code === 'EEXIST') {
                        sendJson(res, 409, { ok: false, error: 'A file with that name already exists.' })
                        return
                    }
                    throw error
                } finally {
                    if (descriptor != null) fs.closeSync(descriptor)
                }

                const relativePath = path.relative(file.path('$cwd'), targetPath)
                const appPath = directoryPath.startsWith('$')
                    ? `${directoryPath.replace(/\\/g, '/')}/${name}`
                    : toPosix(relativePath)
                sendJson(res, 201, { ok: true, path: appPath, content })
            })
            .catch((error) => {
                logger?.('handlers.serve')?.error?.(error)
                sendJson(res, 400, { ok: false, error: 'Unable to create the file.' })
            })
        return true
    }

    if (req.method === 'GET') {
        try {
            const targetPath = requestUrl.searchParams.get('path') || ''
            if (!targetPath) {
                sendJson(res, 400, { ok: false, error: 'A file path is required.' })
                return true
            }

            const resolved = resolveRequestedFile({ configFolder, resolveApiDirectoryTarget, file, targetPath, withinFolder })
            if (!resolved.ok) {
                sendJson(res, 400, resolved)
                return true
            }

            const raw = fs.readFileSync(resolved.resolvedTarget, 'utf8')
            sendJson(res, 200, {
                ok: true,
                path: toPosix(targetPath),
                content: raw,
                mimeType: 'application/octet-stream'
            })
            return true
        } catch (error) {
            logger?.('handlers.serve')?.error?.(error)
            sendJson(res, 500, { ok: false, error: 'Unable to read the file.' })
            return true
        }
    }

    if (req.method === 'POST') {
        readJsonBody(req, 10000000)
            .then((payload) => {
                const targetPath = String(payload.path || '').trim()
                if (!targetPath) {
                    sendJson(res, 400, { ok: false, error: 'A file path is required.' })
                    return
                }

                const resolved = resolveRequestedFile({ configFolder, resolveApiDirectoryTarget, file, targetPath, withinFolder })
                if (!resolved.ok) {
                    sendJson(res, 400, resolved)
                    return
                }

                const content = payload.content == null ? '' : String(payload.content)
                fs.writeFileSync(resolved.resolvedTarget, content, 'utf8')
                sendJson(res, 200, {
                    ok: true,
                    path: toPosix(targetPath),
                    content,
                    savedAt: new Date().toISOString()
                })
            })
            .catch((error) => {
                logger?.('handlers.serve')?.error?.(error)
                sendJson(res, 400, { ok: false, error: 'Invalid request body.' })
            })
        return true
    }

    return false
}
