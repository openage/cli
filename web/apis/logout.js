import * as auth from '../../lib/services/auth.js'

/**
 * Handles the logout API request by terminating the session.
 * 
 * @param {object} params - Request parameters.
 * @param {object} params.req - Node.js request object.
 * @param {object} params.res - Node.js response object.
 * @returns {Promise<boolean>} True if the request was handled, false otherwise.
 */
export const handleLogoutApi = async ({ req, res }) => {
    if (req.method === 'POST' && req.url === '/api/logout') {
        try {
            await auth.logout()
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ isSuccess: true }))
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ isSuccess: false, message: error.message }))
        }
        return true
    }
    return false
}
