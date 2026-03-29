import { readJsonBody, sendJson } from './common.js'

export const handleExecApi = ({ req, res, configFolder, executeCliCommand }) => {
    if (!(req.url && req.url.startsWith('/api/exec') && req.method === 'POST')) {
        return false
    }

    readJsonBody(req)
        .then(async (payload) => {
            const result = await executeCliCommand(payload.command, configFolder)
            sendJson(res, 200, result)
        })
        .catch(() => {
            sendJson(res, 400, { ok: false, code: 1, stderr: 'Invalid request body', stdout: '' })
        })

    return true
}
