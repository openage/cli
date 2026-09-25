import path from 'path'
import { readJsonBody, sendJson } from './common.js'

export const handleGitActionApi = ({ req, res, gitFolder, applyGitAction, getGitSummary, withinFolder, file, toPosix }) => {
    if (!(req.url && req.url.startsWith('/api/git/action') && req.method === 'POST')) {
        return false
    }

    readJsonBody(req)
        .then(async (payload) => {
            let filePath = ''
            if (payload.filePath) {
                const absolutePath = String(payload.filePath).startsWith('$')
                    ? file.path(payload.filePath)
                    : path.resolve(gitFolder, String(payload.filePath))
                if (!withinFolder(file.path('$cwd'), absolutePath)) {
                    sendJson(res, 400, { ok: false, code: 1, stderr: 'Invalid file path.', stdout: '' })
                    return
                }
                filePath = toPosix(path.relative(gitFolder, absolutePath))
            }
            const result = await applyGitAction(gitFolder, payload.action, payload.message, filePath)
            const summary = await getGitSummary(gitFolder)
            sendJson(res, 200, { ...result, summary })
        })
        .catch(() => {
            sendJson(res, 400, { ok: false, code: 1, stderr: 'Invalid request body', stdout: '' })
        })

    return true
}
