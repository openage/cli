import { sendJson } from './common.js'

export const handleAuthApi = ({ req, res, auth, getContextSummary, logger }) => {
    if (req.url !== '/api/auth/renew' || req.method !== 'POST') {
        return false
    }

    auth.login()
        .then(() => {
            sendJson(res, 200, { ok: true, ...getContextSummary() })
        })
        .catch((error) => {
            logger('handlers.serve').error(error)
            sendJson(res, 401, { ok: false, error: 'Authentication failed.' })
        })

    return true
}