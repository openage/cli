import path from 'path'
import { sendJson } from './common.js'

const trimOutput = (text, max = 200000) => {
    const value = String(text || '')
    if (value.length <= max) return value
    return `${value.slice(0, max)}\n...[truncated]`
}

export const handleGitDiffApi = ({ req, res, port, gitFolder, runProcess, withinFolder, file, toPosix }) => {
    if (!(req.url && req.url.startsWith('/api/git/diff') && req.method === 'GET')) {
        return false
    }

    const query = new URL(req.url, `http://localhost:${port}`).searchParams
    const rawPath = String(query.get('path') || '').trim()
    if (!rawPath) {
        sendJson(res, 400, { ok: false, error: 'Path is required.' })
        return true
    }

    const absolutePath = rawPath.startsWith('$')
        ? file.path(rawPath)
        : path.resolve(gitFolder, rawPath)

    if (!withinFolder(file.path('$cwd'), absolutePath)) {
        sendJson(res, 400, { ok: false, error: 'Invalid file path.' })
        return true
    }

    const relativePath = toPosix(path.relative(gitFolder, absolutePath))
    Promise.all([
        runProcess('git', ['diff', '--', relativePath], gitFolder),
        runProcess('git', ['diff', '--cached', '--', relativePath], gitFolder)
    ]).then(([unstaged, staged]) => {
        const unstagedText = trimOutput(unstaged.stdout || unstaged.stderr || '')
        const stagedText = trimOutput(staged.stdout || staged.stderr || '')
        const parts = []
        if (stagedText.trim()) {
            parts.push(`--- STAGED ---\n${stagedText}`)
        }
        if (unstagedText.trim()) {
            parts.push(`--- UNSTAGED ---\n${unstagedText}`)
        }
        sendJson(res, 200, {
            ok: true,
            path: rawPath,
            diff: parts.join('\n\n').trim() || ''
        })
    }).catch((error) => {
        sendJson(res, 500, { ok: false, error: error?.message || 'Unable to get diff.' })
    })

    return true
}
