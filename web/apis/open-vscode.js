import { readJsonBody, sendJson } from './common.js'

export const handleOpenVsCodeApi = ({ req, res, configFolder, openInVsCode }) => {
    if (!(req.url && req.url.startsWith('/api/open-vscode') && req.method === 'POST')) {
        return false
    }

    readJsonBody(req)
        .then(async (payload) => {
            const result = await openInVsCode(configFolder, payload.path)
            sendJson(res, result.ok ? 200 : 400, result)
        })
        .catch(() => {
            sendJson(res, 400, { ok: false, stderr: 'Invalid request body.' })
        })

    return true
}
