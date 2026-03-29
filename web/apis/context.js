import { sendJson } from './common.js'

export const handleContextApi = ({ req, res, getContextSummary, logger }) => {
    if (!(req.url && req.url.startsWith('/api/context'))) {
        return false
    }

    try {
        const payload = getContextSummary()
        sendJson(res, 200, payload)
    } catch (error) {
        logger('handlers.serve').error(error)
        sendJson(res, 500, {
            error: 'Unable to read context',
            tenant: 'N/A',
            organization: 'N/A',
            application: 'N/A',
            user: 'N/A',
            role: 'N/A',
            session: { remainingMs: null, expiresAt: null, status: null, id: null }
        })
    }

    return true
}
