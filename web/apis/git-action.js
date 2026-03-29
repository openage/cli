import { readJsonBody, sendJson } from './common.js'

export const handleGitActionApi = ({ req, res, gitFolder, applyGitAction, getGitSummary }) => {
    if (!(req.url && req.url.startsWith('/api/git/action') && req.method === 'POST')) {
        return false
    }

    readJsonBody(req)
        .then(async (payload) => {
            const result = await applyGitAction(gitFolder, payload.action, payload.message)
            const summary = await getGitSummary(gitFolder)
            sendJson(res, 200, { ...result, summary })
        })
        .catch(() => {
            sendJson(res, 400, { ok: false, code: 1, stderr: 'Invalid request body', stdout: '' })
        })

    return true
}
