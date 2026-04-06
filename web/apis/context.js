import { sendJson } from './common.js'

/**
 * Handles context-related API requests, including summary and granular access via $context.
 * 
 * @param {object} params
 * @param {import('http').IncomingMessage} params.req
 * @param {import('http').ServerResponse} params.res
 * @param {object} params.context - The context service object.
 * @param {function} params.getContextSummary - Function to get context summary.
 * @param {function} params.logger - Logger function.
 * @returns {boolean} True if the request was handled, false otherwise.
 */
export const handleContextApi = ({ req, res, context, getContextSummary, logger }) => {
    const url = req.url || ''
    const isApiContext = url.startsWith('/api/context')
    const isDollarContext = url.startsWith('/$context')

    if (!isApiContext && !isDollarContext) {
        return false
    }

    try {
        if (isApiContext) {
            const payload = getContextSummary()
            sendJson(res, 200, payload)
            return true
        }

        const urlObj = new URL(url, 'http://localhost')
        const segments = urlObj.pathname.split('/').filter(Boolean)
        const segment = segments[1]
        const ctxObject = { ...context.toObject(), env: process.env.NODE_ENV || 'prod' }

        if (!segment) {
            sendJson(res, 200, ctxObject)
            return true
        }

        const payload = ctxObject[segment]
        if (payload === undefined) {
            sendJson(res, 404, { error: `Context segment '${segment}' not found` })
        } else {
            sendJson(res, 200, payload)
        }
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
