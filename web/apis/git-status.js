import { sendJson } from './common.js'

export const handleGitStatusApi = ({ req, res, gitFolder, getGitSummary }) => {
    if (!(req.url && req.url.startsWith('/api/git/status') && req.method === 'GET')) {
        return false
    }

    getGitSummary(gitFolder)
        .then((summary) => {
            sendJson(res, 200, summary)
        })
        .catch((error) => {
            sendJson(res, 500, { available: false, error: error?.message || 'Git unavailable' })
        })

    return true
}
