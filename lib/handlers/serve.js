import http from 'http'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import * as context from '../services/context.js'
import * as file from '../helpers/file.js'
import { settings } from '../helpers/data.js'
import logger from '../helpers/logger.js'
import { handleOpenVsCodeApi } from '../../web/apis/open-vscode.js'
import { handleGitStatusApi } from '../../web/apis/git-status.js'
import { handleGitActionApi } from '../../web/apis/git-action.js'
import { handleExecApi } from '../../web/apis/exec.js'
import { handleContextApi } from '../../web/apis/context.js'
import { handleConfigApi } from '../../web/apis/config.js'
import { handleMetaApi } from '../../web/apis/meta.js'
import { handleDirApi } from '../../web/apis/dir.js'
import { handleGitDiffApi } from '../../web/apis/git-diff.js'

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
}

const ALLOWED_COMMANDS = new Set(['pull', 'push', 'script', 'serve', 'config', 'test'])

const applyCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
}

const decodeJwtPayload = (token) => {
    if (!token || typeof token !== 'string') {
        return null
    }

    const parts = token.split('.')
    if (parts.length < 2) {
        return null
    }

    const payloadPart = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4)

    try {
        const json = Buffer.from(padded, 'base64').toString('utf8')
        return JSON.parse(json)
    } catch {
        return null
    }
}

const parseDateValue = (value) => {
    if (!value) {
        return null
    }

    if (typeof value === 'number') {
        return value < 1000000000000 ? value * 1000 : value
    }

    if (typeof value === 'string') {
        const asNumber = Number(value)
        if (!Number.isNaN(asNumber) && asNumber > 0) {
            return asNumber < 1000000000000 ? asNumber * 1000 : asNumber
        }
        const parsed = Date.parse(value)
        return Number.isNaN(parsed) ? null : parsed
    }

    return null
}

const getSessionExpiryMs = (session) => {
    if (!session || typeof session !== 'object') {
        return null
    }

    const candidateKeys = [
        'expiresAt',
        'expiry',
        'expiresOn',
        'expires',
        'expiration',
        'validTill',
        'validTo',
        'endDate',
        'end'
    ]

    for (const key of candidateKeys) {
        const parsed = parseDateValue(session[key])
        if (parsed) {
            return parsed
        }
    }

    const jwtPayload = decodeJwtPayload(session.token)
    if (jwtPayload?.exp) {
        return parseDateValue(jwtPayload.exp)
    }

    return null
}

const getDisplayValue = (value, fallback = 'N/A') => {
    if (!value) {
        return fallback
    }

    const toDisplayString = (candidate) => {
        if (candidate == null) {
            return null
        }
        if (typeof candidate === 'string') {
            return candidate
        }
        if (typeof candidate === 'number' || typeof candidate === 'boolean' || typeof candidate === 'bigint') {
            return String(candidate)
        }
        return null
    }

    if (typeof value !== 'object') {
        return toDisplayString(value) || fallback
    }

    if (value.profile) {
        const fullName = `${value.profile.firstName || ''} ${value.profile.lastName || ''}`.trim()
        return toDisplayString(fullName) || toDisplayString(value.name) || toDisplayString(value.email) || toDisplayString(value.code) || toDisplayString(value.id) || fallback
    }

    if (value.type && typeof value.type === 'object') {
        return toDisplayString(value.type.name) || toDisplayString(value.type.code) || toDisplayString(value.name) || toDisplayString(value.code) || toDisplayString(value.id) || fallback
    }

    return toDisplayString(value.name) || toDisplayString(value.code) || toDisplayString(value.email) || toDisplayString(value.id) || fallback
}

const getContextSummary = () => {
    const currentContext = context.toObject()
    const currentSession = currentContext.session
    const expiresAtMs = getSessionExpiryMs(currentSession)
    const now = Date.now()

    return {
        env: process.env.NODE_ENV || 'prod',
        tenant: getDisplayValue(currentContext.tenant),
        organization: getDisplayValue(currentContext.organization),
        application: getDisplayValue(currentContext.application),
        user: getDisplayValue(currentContext.user),
        role: getDisplayValue(currentContext.role),
        session: {
            id: currentSession?.id != null ? String(currentSession.id) : null,
            status: currentSession?.status != null ? String(currentSession.status) : null,
            expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
            remainingMs: expiresAtMs ? Math.max(0, expiresAtMs - now) : null
        }
    }
}

const parseCommandTokens = (value) => {
    if (!value || typeof value !== 'string') {
        return []
    }
    const tokens = value.match(/(?:[^\s"]+|"[^"]*")+/g) || []
    return tokens.map((item) => item.replace(/^"|"$/g, ''))
}

const getCliInvocation = (args) => {
    const entryScript = process.argv[1]
    if (entryScript && entryScript.endsWith('.js')) {
        return {
            executable: process.execPath,
            argv: [entryScript, ...args]
        }
    }

    return {
        executable: process.execPath,
        argv: args
    }
}

const executeCliCommand = (rawCommand, cwd) => {
    const tokens = parseCommandTokens(rawCommand)

    if (!tokens.length) {
        return Promise.resolve({
            ok: false,
            code: 1,
            stdout: '',
            stderr: 'Please enter a command.'
        })
    }

    if (tokens[0].toLowerCase() === 'oa') {
        tokens.shift()
    }

    const commandName = (tokens[0] || '').toLowerCase()
    if (!ALLOWED_COMMANDS.has(commandName)) {
        return Promise.resolve({
            ok: false,
            code: 1,
            stdout: '',
            stderr: `Only these commands are allowed: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
        })
    }

    const invocation = getCliInvocation(tokens)
    return new Promise((resolve) => {
        const child = spawn(invocation.executable, invocation.argv, {
            cwd,
            shell: false,
            env: process.env
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
            if (stdout.length > 200000) {
                stdout = `${stdout.slice(0, 200000)}\n...[truncated]`
            }
        })

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
            if (stderr.length > 200000) {
                stderr = `${stderr.slice(0, 200000)}\n...[truncated]`
            }
        })

        const timer = setTimeout(() => {
            child.kill()
            resolve({
                ok: false,
                code: 124,
                stdout,
                stderr: `${stderr}\nCommand timed out after 60s.`
            })
        }, 60000)

        child.on('close', (code) => {
            clearTimeout(timer)
            resolve({
                ok: code === 0,
                code: code ?? 1,
                stdout,
                stderr
            })
        })

        child.on('error', (error) => {
            clearTimeout(timer)
            resolve({
                ok: false,
                code: 1,
                stdout,
                stderr: error.message
            })
        })
    })
}

const runProcess = (command, args, cwd) => {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd,
            shell: false,
            env: process.env
        })

        let stdout = ''
        let stderr = ''

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })

        child.on('close', (code) => {
            resolve({ ok: code === 0, code: code ?? 1, stdout, stderr })
        })
        child.on('error', (error) => {
            resolve({ ok: false, code: 1, stdout, stderr: error.message })
        })
    })
}

const toPosix = (value = '') => value.replaceAll('\\', '/')

const toRelativePosix = (fromPath, toPath) => {
    const relativePath = path.relative(fromPath, toPath)
    return toPosix(relativePath || '.')
}

const resolveApiDirectoryTarget = (configFolder, subPath) => {
    const value = String(subPath || '').trim()
    if (value.startsWith('$')) {
        return file.path(value)
    }
    return path.join(configFolder, value)
}

const getMimeTypeForPath = (targetPath) => {
    const ext = path.extname(targetPath || '').toLowerCase()
    return mimeTypes[ext] || 'application/octet-stream'
}

const parseGitFileStatus = (statusText) => {
    const lines = statusText.split(/\r?\n/).filter(Boolean)
    const statusMap = new Map()

    for (const line of lines) {
        if (line.length < 4) {
            continue
        }

        const x = line[0]
        const y = line[1]
        let filePath = line.slice(3).trim()

        if (filePath.includes(' -> ')) {
            const parts = filePath.split(' -> ')
            filePath = parts[parts.length - 1]
        }

        const normalizedPath = toPosix(filePath)
        let label = 'modified'

        if (x === '?' && y === '?') {
            label = 'untracked'
        } else if (x !== ' ' && y !== ' ') {
            label = 'staged+modified'
        } else if (x !== ' ') {
            label = 'staged'
        } else if (y !== ' ') {
            label = 'modified'
        }

        statusMap.set(normalizedPath, label)
    }

    return statusMap
}

const getGitStatusMap = async (cwd) => {
    const statusRes = await runProcess('git', ['status', '--porcelain'], cwd)
    if (!statusRes.ok) {
        return new Map()
    }
    return parseGitFileStatus(statusRes.stdout)
}

const withinFolder = (base, candidate) => {
    const baseResolved = path.resolve(base)
    const candidateResolved = path.resolve(candidate)
    const relative = path.relative(baseResolved, candidateResolved)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const openInVsCode = async (baseFolder, relativePath) => {
    if (!relativePath || typeof relativePath !== 'string') {
        return { ok: false, stderr: 'Path is required.' }
    }

    const target = relativePath.startsWith('$')
        ? file.path(relativePath)
        : path.resolve(baseFolder, relativePath)
    if (!withinFolder(file.path('$cwd'), target) || !fs.existsSync(target)) {
        return { ok: false, stderr: 'Invalid file path.' }
    }

    return new Promise((resolve) => {
        const child = spawn('code', ['-r', target], {
            detached: true,
            stdio: 'ignore',
            shell: false
        })
        child.on('error', () => {
            resolve({ ok: false, stderr: 'Could not open VS Code. Ensure `code` is available in PATH.' })
        })
        child.unref()
        resolve({ ok: true })
    })
}

const parseGitStatusCounts = (statusText) => {
    const rows = statusText.split(/\r?\n/).filter(Boolean)
    let stagedCount = 0
    let changedCount = 0

    for (const row of rows) {
        const code = row.slice(0, 2)
        const staged = code[0]
        const unstaged = code[1]

        if (staged !== ' ' && staged !== '?') {
            stagedCount++
        }
        if (unstaged !== ' ' || code === '??') {
            changedCount++
        } else if (staged !== ' ' && staged !== '?') {
            changedCount++
        }
    }

    return {
        totalChanged: rows.length,
        stagedCount,
        unstagedCount: Math.max(0, changedCount - stagedCount)
    }
}

const getGitSummary = async (cwd) => {
    const [branchRes, statusRes, commitRes] = await Promise.all([
        runProcess('git', ['rev-parse', '--abbrev-ref', 'HEAD'], cwd),
        runProcess('git', ['status', '--porcelain'], cwd),
        runProcess('git', ['log', '-1', '--pretty=%s'], cwd)
    ])

    if (!branchRes.ok || !statusRes.ok) {
        return {
            available: false,
            branch: 'N/A',
            totalChanged: 0,
            stagedCount: 0,
            unstagedCount: 0,
            lastCommitMessage: 'No git repository detected.',
            error: (branchRes.stderr || statusRes.stderr || '').trim() || 'Git unavailable'
        }
    }

    const counts = parseGitStatusCounts(statusRes.stdout)
    return {
        available: true,
        branch: branchRes.stdout.trim() || 'detached',
        totalChanged: counts.totalChanged,
        stagedCount: counts.stagedCount,
        unstagedCount: counts.unstagedCount,
        lastCommitMessage: commitRes.ok ? commitRes.stdout.trim() || '(no commits yet)' : '(no commits yet)'
    }
}

const applyGitAction = async (cwd, action, message) => {
    switch (action) {
        case 'stage':
            return runProcess('git', ['add', '-A'], cwd)
        case 'unstage':
            return runProcess('git', ['reset'], cwd)
        case 'revert':
            return runProcess('git', ['restore', '--worktree', '--', '.'], cwd)
        case 'commit': {
            if (!message || !String(message).trim()) {
                return { ok: false, code: 1, stdout: '', stderr: 'Commit message is required.' }
            }
            const stageRes = await runProcess('git', ['add', '-A'], cwd)
            if (!stageRes.ok) {
                return stageRes
            }
            return runProcess('git', ['commit', '-m', String(message).trim()], cwd)
        }
        default:
            return { ok: false, code: 1, stdout: '', stderr: 'Unsupported action.' }
    }
}

const formatRemainingMs = (ms) => {
    if (ms == null) {
        return 'Unknown'
    }
    if (ms <= 0) {
        return 'Expired'
    }

    const totalSeconds = Math.floor(ms / 1000)
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

const escapeHtml = (value = '') => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const normalizeToPathname = (urlValue = '/') => {
    const pathname = new URL(urlValue, 'http://localhost').pathname || '/'
    return pathname.endsWith('/') ? pathname : `${pathname}/`
}

const buildChildHref = (basePath, childName) => {
    const safeName = encodeURIComponent(childName)
    if (basePath === '/') {
        return `/${safeName}`
    }
    return `${basePath}${safeName}`
}

const buildParentHref = (basePath) => {
    if (basePath === '/') {
        return null
    }
    const trimmed = basePath.replace(/\/$/, '')
    const lastSlash = trimmed.lastIndexOf('/')
    return lastSlash <= 0 ? '/' : `${trimmed.slice(0, lastSlash)}/`
}

const renderDirectoryListing = (requestUrl, entries) => {
    const contextSummary = getContextSummary()
    const currentPath = normalizeToPathname(requestUrl)
    const sortedEntries = [...entries].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
    })
    const parentHref = buildParentHref(currentPath)
    const rows = sortedEntries.map((entry) => {
        const href = buildChildHref(currentPath, entry.name)
        const safeLabel = escapeHtml(entry.name)
        const itemClass = entry.type === 'directory' ? 'is-directory' : 'is-file'
        return `<a class="dir-item ${itemClass}" href="${href}" title="${safeLabel}"><span class="dir-icon" aria-hidden="true"></span><span class="dir-name">${safeLabel}</span></a>`
    }).join('')
    const parentRow = parentHref
        ? `<a class="dir-item is-directory" href="${parentHref}" title="Up one level"><span class="dir-icon" aria-hidden="true"></span><span class="dir-name">..</span></a>`
        : ''
    const statusBarHtml = `
      <footer class="status-bar">
        <span class="status-item"><span class="status-label">Tenant:</span><span class="status-value">${escapeHtml(contextSummary.tenant)}</span></span>
        <span class="status-item"><span class="status-label">Organization:</span><span class="status-value">${escapeHtml(contextSummary.organization)}</span></span>
        <span class="status-item"><span class="status-label">Application:</span><span class="status-value">${escapeHtml(contextSummary.application)}</span></span>
        <span class="status-item"><span class="status-label">User:</span><span class="status-value">${escapeHtml(contextSummary.user)}</span></span>
        <span class="status-item"><span class="status-label">Role:</span><span class="status-value">${escapeHtml(contextSummary.role)}</span></span>
        <span class="status-item"><span class="status-label">Session Left:</span><span class="status-value">${escapeHtml(formatRemainingMs(contextSummary.session.remainingMs))}</span></span>
      </footer>
    `

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Directory Listing - OA CLI Docs</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand"><img src="https://raw.githubusercontent.com/openage/openage.github.io/master/logo.png" alt="OA CLI"/><div><strong>OA CLI</strong><br /><small>Interactive docs</small></div></div>
      <div class="nav">
        <h3>Directory</h3>
        <p class="summary">${escapeHtml(currentPath)}</p>
      </div>
      <div class="nav">
        <h3>Navigation</h3>
        <a href="/">Home</a>
      </div>
    </aside>
    <main class="main">
      <section class="hero">
        <div>
          <h1>Directory Listing</h1>
          <div class="tag">Live</div>
        </div>
        <p class="summary">Browse files using the same documentation theme.</p>
      </section>
      <section class="card nav">
        <h3>Contents</h3>
        ${parentRow}
        ${rows || '<p class="summary">This directory is empty.</p>'}
      </section>
    </main>
  </div>
  ${statusBarHtml}
</body>
</html>`
}

export const execute = async (options) => {
    logger('handlers.serve').silly('execute')

    // Ensure defaults are set in config
    settings.getOrSet('serve.folder', '$data')
    settings.getOrSet('serve.port', 3000)

    const defaultFolder = settings.getOrSet('serve.folder', '$data')
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const cliWebFolder = path.resolve(__dirname, '..', '..', 'web')
    const rawFolder = options.folder || settings.get('serve.folder') || defaultFolder
    const configFolder = file.path(rawFolder)
    const port = options.port || settings.getOrSet('serve.port', 3000)
    const gitFolder = file.path('$cwd') || process.cwd()

    const server = http.createServer(async (req, res) => {
        applyCorsHeaders(res)

        if (req.method === 'OPTIONS') {
            res.writeHead(204)
            res.end()
            return
        }

        if (handleOpenVsCodeApi({ req, res, configFolder, openInVsCode })) return
        if (handleGitStatusApi({ req, res, gitFolder, getGitSummary })) return
        if (handleGitActionApi({ req, res, gitFolder, applyGitAction, getGitSummary })) return
        if (handleGitDiffApi({ req, res, port, gitFolder, runProcess, withinFolder, file, toPosix })) return
        if (handleExecApi({ req, res, configFolder, executeCliCommand })) return
        if (handleContextApi({ req, res, getContextSummary, logger })) return
        if (handleConfigApi({ req, res, configFolder, executeCliCommand, settings, logger })) return
        if (handleMetaApi({ req, res, port, configFolder, resolveApiDirectoryTarget, withinFolder, file, toPosix, logger })) return
        if (handleDirApi({
            req,
            res,
            port,
            configFolder,
            fs,
            resolveApiDirectoryTarget,
            getGitStatusMap,
            toPosix,
            getMimeTypeForPath,
            toRelativePosix,
            file
        })) return

        let filePath

        const requestPathname = req.url
            ? new URL(req.url, `http://localhost:${port}`).pathname
            : '/'

        if (!requestPathname || requestPathname === '/' || requestPathname === '/index.html') {
            if (fs.existsSync(path.join(cliWebFolder, 'index.html'))) {
                filePath = path.join(cliWebFolder, 'index.html')
            } else {
                filePath = path.join(configFolder, 'index.html')
            }
        } else if (requestPathname.startsWith('/web/')) {
            const webRel = requestPathname.replace(/^\//, '')
            filePath = path.join(cliWebFolder, webRel)
        } else {
            const relPath = decodeURIComponent(requestPathname.replace(/^\//, ''))
            const configPath = relPath.startsWith('$')
                ? file.path(relPath)
                : path.join(configFolder, relPath)

            if (fs.existsSync(configPath)) {
                filePath = configPath
            } else {
                const webPath = path.join(cliWebFolder, relPath)
                if (fs.existsSync(webPath)) {
                    filePath = webPath
                } else if (requestPathname === '/' || requestPathname === '/index.html') {
                    filePath = fs.existsSync(path.join(cliWebFolder, 'index.html'))
                        ? path.join(cliWebFolder, 'index.html')
                        : path.join(configFolder, 'index.html')
                } else {
                    filePath = configPath
                }
            }
        }

        fs.stat(filePath, (err, stats) => {
            if (err) {
                res.writeHead(404)
                res.end('File not found')
                return
            }

            if (stats.isDirectory()) {
                fs.readdir(filePath, { withFileTypes: true }, (err, dirents) => {
                    if (err) {
                        res.writeHead(500)
                        res.end('Server error')
                        return
                    }

                    const entries = dirents.map((entry) => ({
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file'
                    }))
                    const html = renderDirectoryListing(req.url || '/', entries)
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                    res.end(html)
                })
            } else {
                const ext = path.extname(filePath)
                const mimeType = mimeTypes[ext] || 'text/plain'

                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        res.writeHead(404)
                        res.end('File not found')
                        return
                    }

                    res.writeHead(200, { 'Content-Type': mimeType })
                    res.end(data)
                })
            }
        })
    })

    server.listen(port, () => {
        logger('handlers.serve').info(`Server running at http://localhost:${port}`)
        logger('handlers.serve').info(`Serving ${configFolder}`)
    })

    // Keep the process running
    return new Promise(() => { })
}
