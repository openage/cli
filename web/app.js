import { commands } from './command-data.js'
import { formatRemaining } from './modules/utils.js'
import { createGitUi } from './modules/git-ui.js'
import { createTerminalUi } from './modules/terminal-ui.js'
import { createContentUi } from './modules/content-ui.js'
import { createThemeUi } from './modules/theme-ui.js'
import { ui } from './modules/ui.js'

const themeUi = createThemeUi()

const mainContent = document.querySelector('#main-content')
const dirList = document.querySelector('#dir-list')
const statusBar = document.querySelector('#status-bar')
const terminalHost = document.querySelector('#terminal-host')
const terminalToggleTab = document.querySelector('#terminal-toggle-tab')
const appRoot = document.querySelector('.app')
const pageTitle = document.querySelector('#page-title')
const workspaceLabel = document.querySelector('#workspace-label')
const userAvatar = document.querySelector('#user-avatar')
const userPopup = document.querySelector('#user-popup')
const userPopupDetails = document.querySelector('#user-popup-details')
const userPopupSessionActions = document.querySelector('#user-session-actions')
const userLoginAction = document.querySelector('#user-login-action')
const headerBreadcrumb = document.querySelector('#header-breadcrumb')
const explorerPane = document.querySelector('#explorer-pane')
const explorerTitle = document.querySelector('#explorer-title')
const activityRail = document.querySelector('.activity-rail')

let sessionCountdownTimer = null
let sessionExpiryMs = null
let sessionStatus = ''
let gitRefreshTimer = null
let pendingTerminalCommand = 'oa pull'
let currentPath = ''
let currentSelectedPath = ''
let currentSection = 'overview'
let currentRoot = 'home'
let isExplorerVisible = true
let currentEnv = 'prod'
let currentTenant = ''
let currentUser = ''
let currentGitSummary = {}
let currentContextData = { role: '', application: '', organization: '', session: { remainingMs: null } }
let isTerminalVisible = true
let hasInitializedRoute = false
let currentMonitView = ''
let currentLogFilters = { date: '', file: '', operation: '', errorType: '', search: '', page: 0 }
let monitorAutoRefreshEnabled = false
let monitorRefreshTimer = null
let logsAutoRefreshEnabled = false
let logRefreshTimer = null
try { monitorAutoRefreshEnabled = localStorage.getItem('oa.monitor.autoRefresh') === 'true' } catch { /* use the default */ }
try { logsAutoRefreshEnabled = localStorage.getItem('oa.logs.autoRefresh') === 'true' } catch { /* use the default */ }
let isRestoringHistory = false
let pinnedPaths = []
let currentConfigPayload = { data: {} }
let contentUi = null
const expandedTreePaths = new Set()
const initializedTreeRoots = new Set()

const syncActivityBar = () => {
    const labels = new Map([
        ['home', 'Home'],
        ['data', 'Data Explorer'],
        ['specs', 'Specs Explorer'],
        ['preferences', 'Preferences']
    ])
    explorerPane?.classList.toggle('hidden', !isExplorerVisible)
    appRoot?.classList.toggle('explorer-hidden', !isExplorerVisible)
    if (explorerTitle) explorerTitle.textContent = labels.get(currentRoot) || 'Home'
    document.querySelector('#preferences-appearance')?.toggleAttribute('hidden', currentRoot !== 'preferences')
    document.querySelectorAll('.activity-root[data-root]').forEach((button) => {
        const active = button.getAttribute('data-root') === currentRoot
        button.classList.toggle('is-active', active)
        button.setAttribute('aria-pressed', String(active))
    })
}

const cardCommands = commands.filter((cmd) => ['init', 'validate', 'pull', 'push', 'monit', 'script', 'config', 'context', 'test'].includes(cmd.name))
const commandIcons = {
    init: '\u26A1',
    validate: '\u2611',
    pull: '\u2B07',
    push: '\u2B06',
    monit: '\uD83D\uDD04',
    script: '\u2699',
    config: '\u2692',
    context: '\u25C9',
    test: '\u2713'
}

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderMonitLogs = async (filters = currentLogFilters) => {
    if (logRefreshTimer) clearTimeout(logRefreshTimer)
    logRefreshTimer = null
    currentLogFilters = { ...currentLogFilters, ...filters }
    const activeFilters = { ...currentLogFilters }
    const query = new URLSearchParams({ page: String(activeFilters.page || 0), pageSize: '100' })
    for (const key of ['date', 'file', 'operation', 'errorType', 'search']) {
        if (activeFilters[key]) query.set(key, activeFilters[key])
    }
    mainContent.innerHTML = '<section class="card monit-log-view"><h1>Logs</h1><p class="summary">Loading workspace operation logs…</p></section>'
    try {
        const response = await fetch(`/api/monit/logs?${query.toString()}`)
        const payload = await response.json()
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to load monitor logs.')
        const selectOptions = (values, selected, label) => `<option value="">All ${label}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}`
        const rows = (payload.entries || []).map((entry) => {
            const detailText = JSON.stringify(entry, null, 2)
            const timestamp = entry.at || entry.date
            const timestampDate = new Date(timestamp)
            const absoluteTime = Number.isNaN(timestampDate.getTime()) ? String(timestamp || '') : timestampDate.toLocaleString()
            const elapsedSeconds = Number.isNaN(timestampDate.getTime()) ? null : Math.max(0, Math.floor((Date.now() - timestampDate.getTime()) / 1000))
            const relativeTime = elapsedSeconds == null ? String(timestamp || '')
                : elapsedSeconds < 10 ? 'just now'
                    : elapsedSeconds < 60 ? `${elapsedSeconds} seconds ago`
                        : elapsedSeconds < 3600 ? `${Math.floor(elapsedSeconds / 60)} minutes ago`
                            : elapsedSeconds < 86400 ? `${Math.floor(elapsedSeconds / 3600)} hours ago`
                                : elapsedSeconds < 604800 ? `${Math.floor(elapsedSeconds / 86400)} days ago`
                                    : elapsedSeconds < 2592000 ? `${Math.floor(elapsedSeconds / 604800)} weeks ago`
                                        : elapsedSeconds < 31536000 ? `${Math.floor(elapsedSeconds / 2592000)} months ago`
                                            : `${Math.floor(elapsedSeconds / 31536000)} years ago`
            const isoTime = Number.isNaN(timestampDate.getTime()) ? '' : timestampDate.toISOString()
            return `<tr><td><time datetime="${escapeHtml(isoTime)}" title="${escapeHtml(absoluteTime)}" aria-label="${escapeHtml(`${relativeTime}; ${absoluteTime}`)}">${escapeHtml(relativeTime)}</time></td><td class="monit-log-file">${escapeHtml(entry.file || entry.logPath)}</td><td>${escapeHtml(entry.operation)}</td><td>${escapeHtml(entry.errorType || '—')}</td><td><details><summary>Details</summary><pre>${escapeHtml(detailText)}</pre></details></td></tr>`
        }).join('')
        const first = payload.total ? (payload.page * payload.pageSize) + 1 : 0
        const last = Math.min((payload.page + 1) * payload.pageSize, payload.total)
        mainContent.innerHTML = `
            <section class="card monit-log-view">
                <header class="monit-log-header"><div><p class="monit-eyebrow">WORKSPACE ACTIVITY</p><h1>Logs</h1><p class="summary">Search pull, push, conflict, validation, and error events from <code>.logs</code>.</p></div><div class="monit-dashboard-actions"><label class="monit-auto-refresh"><input type="checkbox" data-log-auto-refresh ${logsAutoRefreshEnabled ? 'checked' : ''}><span class="monit-switch" aria-hidden="true"></span><span>Auto refresh</span></label><button type="button" class="btn-secondary" data-log-refresh>Refresh</button></div></header>
                <section class="monit-log-results" aria-labelledby="monit-events-title">
                <header class="monit-section-heading monit-events-heading"><div><p class="monit-eyebrow">HISTORY</p><h2 id="monit-events-title">Activity events</h2></div><span class="monit-event-count">${payload.total} events</span></header>
                <form class="monit-log-filters" data-log-filters>
                    <label>Date<input type="date" name="date" value="${escapeHtml(activeFilters.date)}"></label>
                    <label>File path<input type="search" name="file" value="${escapeHtml(activeFilters.file)}" placeholder="Filter by file"></label>
                    <label>Operation<select name="operation">${selectOptions(payload.operations || [], activeFilters.operation, 'operations')}</select></label>
                    <label>Error type<select name="errorType">${selectOptions(payload.errorTypes || [], activeFilters.errorType, 'error types')}</select></label>
                    <label class="monit-log-search">Search details<input type="search" name="search" value="${escapeHtml(activeFilters.search)}" placeholder="Message, reason, hash…"></label>
                    <div class="monit-log-filter-actions"><button type="submit" class="btn-primary">Apply filters</button><button type="button" class="btn-secondary" data-log-clear>Clear</button></div>
                </form>
                <div class="monit-log-summary" aria-live="polite">Showing ${first}–${last} of ${payload.total} matching events · ${payload.dates?.length || 0} log dates</div>
                <div class="table-scroll monit-log-table-wrap"><table class="monit-log-table"><thead><tr><th>Timestamp</th><th>File</th><th>Operation</th><th>Error type</th><th>Details</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No log events match these filters.</td></tr>'}</tbody></table></div>
                <footer class="monit-log-pagination"><button type="button" class="btn-secondary" data-log-page="${Math.max(0, payload.page - 1)}" ${payload.page <= 0 ? 'disabled' : ''}>Previous</button><span>Page ${payload.total ? payload.page + 1 : 0} of ${Math.max(1, Math.ceil(payload.total / payload.pageSize))}</span><button type="button" class="btn-secondary" data-log-page="${payload.page + 1}" ${last >= payload.total ? 'disabled' : ''}>Next</button></footer>
                </section>
            </section>`
        const form = mainContent.querySelector('[data-log-filters]')
        form?.addEventListener('submit', (event) => {
            event.preventDefault()
            const values = Object.fromEntries(new FormData(form).entries())
            renderMonitLogs({ ...values, page: 0 })
        })
        mainContent.querySelector('[data-log-clear]')?.addEventListener('click', () => renderMonitLogs({ date: '', file: '', operation: '', errorType: '', search: '', page: 0 }))
        mainContent.querySelector('[data-log-refresh]')?.addEventListener('click', () => renderMonitLogs({ page: activeFilters.page }))
        mainContent.querySelector('[data-log-auto-refresh]')?.addEventListener('change', (event) => {
            logsAutoRefreshEnabled = event.target.checked
            try { localStorage.setItem('oa.logs.autoRefresh', String(logsAutoRefreshEnabled)) } catch { /* preference is session-only */ }
            renderMonitLogs({ page: activeFilters.page })
        })
        mainContent.querySelectorAll('[data-log-page]').forEach((button) => button.addEventListener('click', () => renderMonitLogs({ page: Number(button.dataset.logPage) })))
        if (logsAutoRefreshEnabled && currentSection === 'logs') logRefreshTimer = setTimeout(() => renderMonitLogs({ page: activeFilters.page }), 30000)
    } catch (error) {
        mainContent.innerHTML = `<section class="card monit-log-view"><h1>Logs</h1><p class="summary">${escapeHtml(error.message)}</p></section>`
        if (logsAutoRefreshEnabled && currentSection === 'logs') logRefreshTimer = setTimeout(() => renderMonitLogs({ page: activeFilters.page }), 30000)
    }
}

const renderStatusItem = (label, value, key) => {
    const item = document.createElement('span')
    item.className = 'status-item'
    item.title = `${label}: ${value || 'N/A'}`

    const labelEl = document.createElement('span')
    labelEl.className = 'status-label'
    labelEl.textContent = `${label}:`

    const valueEl = document.createElement('span')
    valueEl.className = 'status-value'
    valueEl.textContent = value || 'N/A'
    if (key) {
        valueEl.dataset.contextKey = key
    }

    item.appendChild(labelEl)
    item.appendChild(valueEl)
    statusBar.appendChild(item)
}

const getSectionLabel = (section) => {
    if (section === 'data') return 'Data'
    if (section === 'specs') return 'Specs'
    if (section === 'config') return 'Config'
    if (section === 'context') return 'Context'
    if (section === 'monitor') return 'Monitor'
    if (section === 'logs') return 'Logs'
    if (section === 'help') return 'Help'
    if (section === 'changelog') return 'Changelog'
    if (section === 'pinned') return 'Pinned'
    return 'Overview'
}

const hasLoggedInUser = () => {
    const user = String(currentUser || '').trim().toLowerCase()
    return Boolean(user && !['n/a', 'unknown', 'not signed in', 'anonymous'].includes(user))
}

const isSessionExpired = () => {
    const remaining = sessionExpiryMs == null ? null : Math.max(0, sessionExpiryMs - Date.now())
    return remaining === 0 || sessionStatus.toLowerCase() === 'expired'
}

const refreshUserPopup = () => {
    const loggedIn = hasLoggedInUser()
    const expired = loggedIn && isSessionExpired()
    const name = String(currentUser || '').trim()
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'OA'

    if (userAvatar) {
        userAvatar.classList.toggle('is-logged-out', !loggedIn)
        userAvatar.classList.toggle('is-session-expired', expired)
        userAvatar.setAttribute('title', loggedIn ? `${name}${expired ? ' (session expired)' : ''}` : 'Sign in')
        userAvatar.setAttribute('aria-label', loggedIn ? `User menu for ${name}` : 'Sign in')
        userAvatar.innerHTML = loggedIn
            ? escapeHtml(initials)
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>'
    }

    const nameEl = document.querySelector('#user-popup-name')
    const roleEl = document.querySelector('#user-popup-role')
    const applicationEl = document.querySelector('#user-popup-application')
    const organizationEl = document.querySelector('#user-popup-organization')
    const sessionStateEl = document.querySelector('#user-popup-session-state')
    const sessionEl = document.querySelector('#user-popup-session')
    if (nameEl) nameEl.textContent = loggedIn ? name : 'Not signed in'
    if (roleEl) roleEl.textContent = loggedIn ? String(currentContextData.role || '') : ''
    if (applicationEl) applicationEl.textContent = loggedIn ? String(currentContextData.application || 'N/A') : 'N/A'
    if (organizationEl) organizationEl.textContent = loggedIn ? String(currentContextData.organization || 'N/A') : 'N/A'
    if (sessionStateEl) {
        sessionStateEl.textContent = loggedIn ? (expired ? 'Session expired' : 'Signed in') : 'Signed out'
        sessionStateEl.classList.toggle('is-expired', expired)
    }
    if (sessionEl) sessionEl.textContent = loggedIn ? formatRemaining(sessionExpiryMs == null ? currentContextData.session?.remainingMs : Math.max(0, sessionExpiryMs - Date.now())) : 'N/A'
    if (loggedIn) {
        userPopupDetails?.removeAttribute('hidden')
        userPopupSessionActions?.removeAttribute('hidden')
        userLoginAction?.setAttribute('hidden', '')
    } else {
        userPopupDetails?.setAttribute('hidden', '')
        userPopupSessionActions?.setAttribute('hidden', '')
        userLoginAction?.removeAttribute('hidden')
    }
}

const refreshTopbar = () => {
    if (pageTitle) {
        pageTitle.textContent = getSectionLabel(currentSection)
    }
    if (workspaceLabel) {
        const tenantLabel = String(currentTenant || 'tenant')
        const envLabel = String(currentEnv || 'prod').toUpperCase()
        workspaceLabel.textContent = `${tenantLabel} | ${envLabel}`
    }
    refreshUserPopup()
}

const renderHeaderBreadcrumb = () => {
    if (!headerBreadcrumb) return

    if (currentSection === 'overview' || currentSection === 'monitor' || currentSection === 'logs') {
        headerBreadcrumb.innerHTML = `<span>${escapeHtml(currentSection === 'overview' ? 'overview' : currentSection === 'logs' ? 'monitor logs' : 'monitor')}</span>`
        return
    }

    const root = currentSection === 'data' ? '$content' : (currentSection === 'specs' ? '$specs' : currentSection)
    const rawPath = currentPath || root
    const segments = String(rawPath).split('/').filter(Boolean)

    const crumbs = ['<button type="button" class="crumb" data-crumb-path="">Home</button>']
    let acc = ''

    segments.forEach((segment) => {
        acc = acc ? `${acc}/${segment}` : segment
        crumbs.push(`<span class="separator">/</span><button type="button" class="crumb" data-crumb-path="${escapeHtml(acc)}">${escapeHtml(segment)}</button>`)
    })

    headerBreadcrumb.innerHTML = crumbs.join('')
}

const parseFragmentState = () => {
    const raw = window.location.hash?.replace(/^#/, '').trim()
    if (!raw) return {}
    const params = new URLSearchParams(raw)
    const section = params.get('section') || ''
    const path = params.get('path') || ''
    const terminal = params.get('terminal')
    const monit = params.get('monit') || ''
    return {
        section,
        path,
        monit,
        terminal: terminal == null ? null : terminal !== '0'
    }
}

const syncFragmentState = () => {
    const params = new URLSearchParams()
    params.set('section', currentSection || 'overview')
    const routePath = currentSelectedPath || currentPath
    if (routePath) params.set('path', routePath)
    params.set('terminal', isTerminalVisible ? '1' : '0')
    if (currentMonitView) params.set('monit', currentMonitView)
    const next = `#${params.toString()}`
    if (window.location.hash !== next) {
        const previous = parseFragmentState()
        const previousSection = previous.section || 'overview'
        const routeChanged = previousSection !== (currentSection || 'overview') || previous.path !== routePath
        if (hasInitializedRoute && !isRestoringHistory && routeChanged) {
            window.history.pushState(null, '', next)
        } else {
            window.history.replaceState(null, '', next)
        }
    }
}

const refreshTerminalTabLabel = () => {
    if (!terminalToggleTab) return
    const label = isTerminalVisible ? 'Hide Terminal' : 'Show Terminal'
    terminalToggleTab.setAttribute('title', label)
    terminalToggleTab.setAttribute('aria-label', label)
    terminalToggleTab.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18M${isTerminalVisible ? '7 9l3 3-3 3' : '10 9l-3 3 3 3'}" />
        </svg>
    `
}

const setTerminalVisibility = (visible, skipSave = false) => {
    isTerminalVisible = Boolean(visible)
    appRoot?.classList.toggle('terminal-collapsed', !isTerminalVisible)
    refreshTerminalTabLabel()
    syncFragmentState()

    if (!skipSave) {
        saveConfig({ key: 'ux.terminal.mode', value: isTerminalVisible ? 'expanded' : 'collapsed', encrypt: false })
    }
}

const runWebCommand = async (command, specPath = '') => {
    const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
    })
    const result = await res.json()
    contentUi?.recordSpecRunResult(command, result, specPath)
    return result
}

const terminalUi = createTerminalUi({
    terminalHost,
    getPendingCommand: () => pendingTerminalCommand,
    setPendingCommand: (value) => {
        pendingTerminalCommand = value
    },
    onExecute: runWebCommand
})

contentUi = createContentUi({
    mainContent,
    cardCommands,
    commandIcons,
    onUseCommand: (command) => terminalUi.setCommand(command),
    onRunSpecCommand: runWebCommand,
    onAddLocalPath: (relativePath) => terminalUi.upsertLocalPath(relativePath),
    isPinned: (filePath) => pinnedPaths.includes(filePath),
    onTogglePin: async (filePath) => {
        pinnedPaths = pinnedPaths.includes(filePath)
            ? pinnedPaths.filter((item) => item !== filePath)
            : [...pinnedPaths, filePath]
        await saveConfig({ key: 'ux.pinned.files', value: pinnedPaths, encrypt: false })
        await renderDirectoryNav(currentPath, currentSection)
        return pinnedPaths.includes(filePath)
    }
})

const gitUi = createGitUi({ statusBar })

const loadDirectoryEntries = async (path = '') => {
    const query = path ? `?path=${encodeURIComponent(path)}` : ''
    const res = await fetch(`/api/dir${query}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
}

const loadConfig = async () => {
    const res = await fetch('/api/config')
    return res.json()
}

const saveConfig = async ({ key, value, encrypt }) => {
    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, encrypt })
    })
    const data = await res.json()
    if (key.startsWith('ux.')) {
        await loadContext()
    }
    return data
}

const loadMeta = async (path = '$content', metaFile = '') => {
    const query = new URLSearchParams({ path })
    if (metaFile) query.set('metaFile', metaFile)
    const res = await fetch(`/api/meta?${query.toString()}`)
    return res.json()
}

const loadFileContent = async (targetPath) => {
    const query = new URLSearchParams({ path: targetPath })
    const res = await fetch(`/api/file?${query.toString()}`)
    return res.json()
}

const saveFileContent = async ({ path, content }) => {
    const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
    })
    return res.json()
}

const createFile = async ({ directory, name }) => {
    try {
        const res = await fetch('/api/file/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory, name })
        })
        return await res.json()
    } catch {
        return { ok: false, error: 'Unable to connect to the file service.' }
    }
}

const loadRemoteFile = async (targetPath) => {
    const query = new URLSearchParams({ path: targetPath })
    try {
        const res = await fetch(`/api/remote-file?${query.toString()}`)
        return await res.json()
    } catch {
        return { ok: false, error: 'Unable to connect to the remote comparison service.' }
    }
}

const loadRemoteDirectory = async (targetPath) => {
    const query = new URLSearchParams({ path: targetPath })
    try {
        const res = await fetch(`/api/remote-directory?${query.toString()}`)
        return await res.json()
    } catch {
        return { ok: false, error: 'Unable to connect to the remote folder service.' }
    }
}

const runSyncAction = async ({ action, path: targetPath }) => {
    try {
        const res = await fetch('/api/remote-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, path: targetPath })
        })
        return await res.json()
    } catch {
        return { ok: false, error: 'Unable to connect to the remote synchronization service.' }
    }
}

const saveMeta = async ({ path, metaFile, meta }) => {
    const res = await fetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, metaFile, meta })
    })
    return res.json()
}

const loadGitDiff = async (path) => {
    const query = new URLSearchParams({ path })
    const res = await fetch(`/api/git/diff?${query.toString()}`)
    return res.json()
}

const getRootPathForSection = (section) => {
    if (section === 'data') return '$content'
    if (section === 'specs') return '$specs'
    return ''
}

const openOverview = async () => {
    currentPath = ''
    currentSection = 'overview'
    currentRoot = 'home'
    syncActivityBar()
    refreshTopbar()
    renderHeaderBreadcrumb()
    await contentUi.renderHome(currentContextData, currentGitSummary)
    syncFragmentState()
}

const openHelp = async () => {
    currentPath = ''
    currentSection = 'help'
    currentRoot = 'preferences'
    syncActivityBar()
    refreshTopbar()
    renderHeaderBreadcrumb()
    await contentUi.renderHelp()
    syncFragmentState()
}

const openChangelog = async () => {
    currentPath = ''
    currentSection = 'changelog'
    currentRoot = 'preferences'
    syncActivityBar()
    refreshTopbar()
    renderHeaderBreadcrumb()

    const res = await fetch('/CHANGELOG.md')
    if (!res.ok) {
        mainContent.innerHTML = '<p class="summary">Unable to load the changelog.</p>'
        return
    }
    await contentUi.renderChangelog(await res.text())
    syncFragmentState()
}

const openContext = async (focusId = '') => {
    currentPath = ''
    currentSection = 'context'
    currentRoot = 'preferences'
    syncActivityBar()
    refreshTopbar()
    renderHeaderBreadcrumb()
    const res = await fetch('/api/context')
    const data = await res.json()
    await contentUi.renderContext(data)
    if (focusId) mainContent?.querySelector(`#${CSS.escape(focusId)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    syncFragmentState()
}

const openPinned = async () => {
    currentPath = ''
    currentSection = 'pinned'
    refreshTopbar()
    renderHeaderBreadcrumb()
    const renderPinnedRows = (root) => pinnedPaths
        .filter((filePath) => filePath.startsWith(`${root}/`))
        .map((filePath) => {
            const parts = String(filePath).split('/').filter(Boolean)
            const name = parts.at(-1) || filePath
            const relativePath = `${root === '$content' ? 'data' : 'specs'}/${parts.slice(1, -1).join('/')}`
            return `<article class="dir-row card is-file" data-pinned-path="${escapeHtml(filePath)}">
                            <div class="file-row-main"><span class="file-icon">{}</span><div class="pinned-file-info"><span class="summary pinned-path">${escapeHtml(relativePath)}/</span><a class="file-name file-link" href="#" data-pinned-open="${escapeHtml(filePath)}" title="Open ${escapeHtml(name)}">${escapeHtml(name)}</a></div></div>
              <div class="file-actions"><button type="button" class="copy-btn" data-pinned-remove="${escapeHtml(filePath)}">Unpin</button></div>
            </article>`
        }).join('')
    const dataRows = renderPinnedRows('$content')
    const specsRows = renderPinnedRows('$specs')
    const renderGroup = (title, rows) => `<section class="pinned-group"><h3>${title}</h3>${rows || '<p class="summary">No pinned JSON files.</p>'}</section>`
    mainContent.innerHTML = `<section class="pinned-groups">${renderGroup('Data', dataRows)}${renderGroup('Specs', specsRows)}</section>`
    mainContent.onclick = async (event) => {
        const open = event.target.closest('[data-pinned-open]')
        if (open) {
            event.preventDefault()
            const filePath = open.dataset.pinnedOpen || ''
            const section = filePath.startsWith('$specs/') ? 'specs' : 'data'
            const parentPath = filePath.slice(0, filePath.lastIndexOf('/')) || getRootPathForSection(section)
            await openDirectory(parentPath, section, filePath)
            await renderDirectoryNav(parentPath, section)
            return
        }

        const remove = event.target.closest('[data-pinned-remove]')
        if (!remove) return
        pinnedPaths = pinnedPaths.filter((item) => item !== remove.dataset.pinnedRemove)
        await saveConfig({ key: 'ux.pinned.files', value: pinnedPaths, encrypt: false })
        await openPinned()
        await renderDirectoryNav('', 'pinned')
    }
    syncFragmentState()
}

const openConfig = async () => {
    currentPath = ''
    currentSection = 'config'
    currentRoot = 'preferences'
    syncActivityBar()
    refreshTopbar()
    renderHeaderBreadcrumb()
    ui.progress({ label: 'Loading Config', value: 40, message: 'Reading settings from disk...' })
    const payload = await loadConfig()
    currentConfigPayload = payload
    ui.progress({ value: 100, message: 'Rendering configuration editor...' })
    await contentUi.renderConfig(
        payload,
        async () => loadConfig(),
        async (key, value, encrypt) => saveConfig({ key, value, encrypt })
    )
    ui.progress(false)
    syncFragmentState()
}

const openDirectory = async (path = '', section = currentSection, selectedPath = '') => {
    currentSection = section
    currentPath = path
    refreshTopbar()
    renderHeaderBreadcrumb()
    ui.progress({ label: 'Navigating', value: 20, message: `Entering ${path || 'root'}...` })
    const entries = await loadDirectoryEntries(path)
    currentSelectedPath = selectedPath && entries.some((entry) => {
        const entryPath = path ? `${path}/${entry.name}` : entry.name
        return entryPath === selectedPath
    }) ? selectedPath : ''
    const metaEnabled = currentSection === 'data' || currentSection === 'specs'
    ui.progress({ value: 50, message: 'Scanning for metadata and Git status...' })
    const metaPayload = metaEnabled ? await loadMeta(path || '$content') : null
    ui.progress({ value: 80, message: 'Rendering directory view...' })
    await contentUi.renderDirectoryContent(
        path,
        entries,
        async (nextPath) => {
            await openDirectory(nextPath, currentSection)
        },
        async (nextPath) => {
            if (!nextPath) {
                await openOverview()
            } else {
                await openDirectory(nextPath, currentSection)
            }
            await renderDirectoryNav(nextPath, currentSection)
        },
        async (nextPath) => {
            await renderDirectoryNav(nextPath, currentSection)
        },
        {
            enabled: metaEnabled,
            section: currentSection,
            payload: metaPayload,
            loadMeta: async (targetPath, metaFile) => loadMeta(targetPath, metaFile),
            loadFileContent: async (targetPath) => loadFileContent(targetPath),
            saveFileContent: async (payloadToSave) => saveFileContent(payloadToSave),
            createFile: async (payloadToCreate) => createFile(payloadToCreate),
            loadRemoteFile: async (targetPath) => loadRemoteFile(targetPath),
            loadRemoteDirectory: async (targetPath) => loadRemoteDirectory(targetPath),
            runSyncAction: async (payload) => runSyncAction(payload),
            onSelectPath: (selected) => {
                currentSelectedPath = selected || ''
                syncFragmentState()
            },
            saveMeta: async (payloadToSave) => saveMeta(payloadToSave),
            loadGitDiff: async (targetPath) => loadGitDiff(targetPath),
            loadEntries: async (targetPath) => loadDirectoryEntries(targetPath),
            commitFile: async ({ path: filePath, message }) => {
                const res = await fetch('/api/git/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'commit', filePath, message })
                })
                const result = await res.json()
                if (result.summary) currentGitSummary = result.summary
                currentGitSummary = await gitUi.loadGitStatus() || currentGitSummary
                return result
            },
            refreshDirectory: async (selected) => openDirectory(path, section, selected),
            selectedPath
        }
    )
    ui.progress(false)
    syncFragmentState()
}

const navIcons = {
    overview: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    data: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    specs: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    pinned: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    config: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    context: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
    help: `<svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    folder: `<svg class="nav-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    folderOpen: `<svg class="nav-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h6l2 3h10l-2 11H4L2 8a2 2 0 0 1 1-2Z"/><path d="M3 9h18"/></svg>`,
    chevron: `<svg class="tree-chevron-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 5 5-5 5"/></svg>`,
    parent: `<svg class="nav-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
}

const renderDirectoryNav = async (path = currentPath, section = currentSection, ensureCurrentPath = true) => {
    try {
        currentRoot = section === 'specs' ? 'specs' : (section === 'data' || section === 'pinned' ? 'data' : (['config', 'context', 'help', 'changelog'].includes(section) ? 'preferences' : 'home'))
        syncActivityBar()
        const rootPath = getRootPathForSection(section)
        const showFolderRows = section === 'data' || section === 'specs'
        const activePath = path || rootPath
        let entries = []
        if (showFolderRows) {
            entries = await loadDirectoryEntries(activePath)
        }
        const treeEntries = new Map([[activePath, entries]])

        const getTreeEntries = async (directoryPath) => {
            if (treeEntries.has(directoryPath)) return treeEntries.get(directoryPath)
            const children = await loadDirectoryEntries(directoryPath)
            treeEntries.set(directoryPath, children)
            return children
        }

        if (showFolderRows && !initializedTreeRoots.has(rootPath)) {
            initializedTreeRoots.add(rootPath)
            expandedTreePaths.add(rootPath)
        }

        if (showFolderRows && ensureCurrentPath && activePath.startsWith(`${rootPath}/`)) {
            const segments = activePath.slice(rootPath.length + 1).split('/').filter(Boolean)
            let ancestor = rootPath
            for (const segment of segments) {
                expandedTreePaths.add(ancestor)
                ancestor = `${ancestor}/${segment}`
            }
            expandedTreePaths.add(ancestor)
        }

        const getExplorerFileIcon = (name) => {
            const lowerName = name.toLowerCase()
            const extension = lowerName.includes('.') ? lowerName.split('.').pop() : ''
            const types = {
                json: ['json', '{}'],
                js: ['javascript', 'JS'],
                mjs: ['javascript', 'JS'],
                cjs: ['javascript', 'JS'],
                ts: ['typescript', 'TS'],
                tsx: ['typescript', 'TS'],
                jsx: ['react', 'JSX'],
                html: ['html', '<>'],
                css: ['css', '#'],
                scss: ['css', '#'],
                md: ['markdown', 'M'],
                yml: ['yaml', 'Y'],
                yaml: ['yaml', 'Y'],
                xml: ['xml', '<>'],
                svg: ['image', 'SVG'],
                png: ['image', 'IMG'],
                jpg: ['image', 'IMG'],
                jpeg: ['image', 'IMG'],
                gif: ['image', 'IMG'],
                mp4: ['video', '▶'],
                mov: ['video', '▶'],
                pdf: ['pdf', 'PDF'],
                txt: ['text', 'TXT']
            }
            const [type, label] = lowerName === 'package.json'
                ? ['npm', 'N']
                : (types[extension] || ['default', '·'])
            return `<span class="vscode-file-icon icon-${type}" aria-hidden="true"><svg viewBox="0 0 16 18"><path d="M2 1.5h7l5 5v10H2z"/><path d="M9 1.5v5h5"/></svg><span>${label}</span></span>`
        }

        const renderTreeEntries = async (parentPath, childEntries) => {
            const rows = []
            for (const entry of childEntries) {
                const fullPath = `${parentPath}/${entry.name}`
                if (entry.type === 'directory') {
                    const expanded = expandedTreePaths.has(fullPath)
                    const nestedEntries = expanded ? await getTreeEntries(fullPath) : []
                    const nestedRows = expanded
                        ? await renderTreeEntries(fullPath, nestedEntries)
                        : ''
                    rows.push(`
                      <div class="tree-node">
                        <div class="tree-row">
                          <button type="button" class="tree-toggle" data-tree-toggle="${escapeHtml(fullPath)}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${escapeHtml(entry.name)}" aria-expanded="${expanded}">${navIcons.chevron}</button>
                          <button type="button" class="nav-link tree-folder-label ${currentPath === fullPath ? 'is-active' : ''}" data-section="${section}" data-dir-path="${escapeHtml(fullPath)}">${expanded ? navIcons.folderOpen : navIcons.folder}<span class="dir-name">${escapeHtml(entry.name)}</span></button>
                        </div>
                        <div class="tree-children" data-tree-children="${escapeHtml(fullPath)}" ${expanded ? '' : 'hidden'}>${expanded ? nestedRows || '<p class="tree-empty">Empty folder</p>' : ''}</div>
                      </div>
                    `)
                } else {
                    rows.push(`
                      <button type="button" class="nav-link tree-file-label" data-section="${section}" data-file-parent="${escapeHtml(parentPath)}" data-select-file-path="${escapeHtml(fullPath)}">${getExplorerFileIcon(entry.name)}<span class="dir-name">${escapeHtml(entry.name)}</span></button>
                    `)
                }
            }
            return rows.join('')
        }

        const parentPath = (() => {
            if (!showFolderRows || !activePath || activePath === rootPath) return ''
            const normalized = activePath.endsWith('/') ? activePath.slice(0, -1) : activePath
            const slashIndex = normalized.lastIndexOf('/')
            if (slashIndex <= 0) return rootPath
            const candidate = normalized.slice(0, slashIndex)
            return candidate || rootPath
        })()

        const treeMarkup = showFolderRows && expandedTreePaths.has(rootPath)
            ? await renderTreeEntries(rootPath, await getTreeEntries(rootPath))
            : ''
        const treeRootExpanded = expandedTreePaths.has(rootPath)

        const configSections = Object.keys(currentConfigPayload?.data || {})
            .sort((a, b) => a.localeCompare(b))
            .map((name) => `<button type="button" class="nav-link config-nav-link" data-config-section="${escapeHtml(name)}"><span class="nav-icon config-section-dot">·</span><span>${escapeHtml(name)}</span></button>`)
            .join('')

        if (currentRoot === 'home') {
            dirList.innerHTML = '<p class="nav-hint">Workspace overview and quick-start commands.</p>'
        } else if (currentRoot === 'preferences') {
            dirList.innerHTML = `
                            <div class="nav-group preferences-links">
                                <h4>Preferences</h4>
                                <button type="button" class="nav-link ${section === 'config' ? 'is-active' : ''}" data-page="config">${navIcons.config}<span>Configuration</span></button>
                                ${section === 'config' ? configSections || '<p class="summary nav-empty">No config sections</p>' : ''}
                                <button type="button" class="nav-link ${section === 'context' ? 'is-active' : ''}" data-page="context">${navIcons.context}<span>Context</span></button>
                                <button type="button" class="nav-link" data-page="user"><svg class="nav-icon user-nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Current User</span></button>
                                <button type="button" class="nav-link ${section === 'changelog' ? 'is-active' : ''}" data-page="changelog">${navIcons.specs}<span>Changelog</span></button>
                                <button type="button" class="nav-link ${section === 'help' ? 'is-active' : ''}" data-page="help">${navIcons.help}<span>Help</span></button>
                            </div>
                        `
        } else {
            const page = currentRoot
            const selectedSection = page === 'data' && section === 'pinned' ? 'pinned' : section
            dirList.innerHTML = `
                            <div class="nav-group">
                                <h4>${page === 'data' ? 'Data Explorer' : 'Specs Explorer'}</h4>
                                ${selectedSection === page ? `
                                    <div class="tree-row">
                                      <button type="button" class="tree-toggle" data-tree-toggle="${escapeHtml(rootPath)}" aria-label="${treeRootExpanded ? 'Collapse' : 'Expand'} ${page === 'data' ? '$content' : '$specs'}" aria-expanded="${treeRootExpanded}">${navIcons.chevron}</button>
                                      <button type="button" class="nav-link tree-folder-label tree-root-label is-active" data-page="${page}">${treeRootExpanded ? navIcons.folderOpen : navIcons.folder}<span>${page === 'data' ? '$content' : '$specs'}</span></button>
                                    </div>
                                    <div class="tree-children tree-root-children" ${treeRootExpanded ? '' : 'hidden'}>${treeRootExpanded ? treeMarkup || '<p class="tree-empty">No files or folders</p>' : ''}</div>
                                ` : `<button type="button" class="nav-link" data-page="${page}">${navIcons[page]}<span>${page === 'data' ? '$content' : '$specs'}</span></button>`}
                                ${page === 'data' ? `<button type="button" class="nav-link ${section === 'pinned' ? 'is-active' : ''}" data-page="pinned">${navIcons.pinned}<span>Pinned</span></button>` : ''}
                            </div>
                        `
        }

        dirList.onclick = async (event) => {
            const pageTarget = event.target.closest('[data-page]')
            if (pageTarget) {
                const page = pageTarget.dataset.page
                if (page === 'overview') {
                    await openOverview()
                    await renderDirectoryNav('', 'overview')
                    return
                }
                if (page === 'help') {
                    await openHelp()
                    await renderDirectoryNav('', 'help')
                    return
                }
                if (page === 'changelog') {
                    await openChangelog()
                    await renderDirectoryNav('', 'changelog')
                    return
                }
                if (page === 'data') {
                    const root = getRootPathForSection('data')
                    await openDirectory(root, 'data')
                    await renderDirectoryNav(root, 'data')
                    return
                }
                if (page === 'specs') {
                    const root = getRootPathForSection('specs')
                    await openDirectory(root, 'specs')
                    await renderDirectoryNav(root, 'specs')
                    return
                }
                if (page === 'pinned') {
                    await openPinned()
                    await renderDirectoryNav('', 'pinned')
                    return
                }
                if (page === 'config') {
                    await openConfig()
                    await renderDirectoryNav('', 'config')
                    return
                }
                if (page === 'context') {
                    await openContext()
                    await renderDirectoryNav('', 'context')
                    return
                }
                if (page === 'user') {
                    await openContext('context-user')
                    await renderDirectoryNav('', 'context')
                    return
                }
            }

            const configSection = event.target.closest('[data-config-section]')
            if (configSection) {
                mainContent.querySelector(`#config-section-${CSS.escape(configSection.dataset.configSection || '')}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                return
            }

            const treeToggle = event.target.closest('[data-tree-toggle]')
            if (treeToggle) {
                const treePath = treeToggle.dataset.treeToggle || ''
                if (expandedTreePaths.has(treePath)) {
                    expandedTreePaths.delete(treePath)
                } else {
                    expandedTreePaths.add(treePath)
                }
                await renderDirectoryNav(currentPath, section, false)
                return
            }

            const fileTarget = event.target.closest('[data-select-file-path]')
            if (fileTarget) {
                const parentPath = fileTarget.dataset.fileParent || activePath
                await openDirectory(parentPath, section, fileTarget.dataset.selectFilePath || '')
                await renderDirectoryNav(parentPath, section)
                return
            }

            const target = event.target.closest('[data-dir-path]')
            if (!target) return

            const next = target.dataset.dirPath || ''
            const nextSection = target.dataset.section || section
            currentSection = nextSection
            currentPath = next
            await renderDirectoryNav(next, nextSection)
            if (!next) {
                await openOverview()
            } else {
                await openDirectory(next, nextSection)
            }
        }
    } catch {
        dirList.textContent = 'Unable to load directory.'
    }
}

const renderSessionTimeLeft = () => {
    refreshUserPopup()
}

const renewSession = async (button) => {
    const action = button.dataset.userAction || 'renew'
    button.disabled = true
    button.textContent = action === 'login' ? 'Signing in...' : 'Renewing...'
    try {
        const res = await fetch('/api/auth/renew', { method: 'POST' })
        if (!res.ok) throw new Error('Authentication failed')
        await loadContext()
        button.disabled = false
        button.textContent = action === 'login' ? 'Sign in' : 'Renew session'
    } catch {
        button.disabled = false
        button.textContent = action === 'login' ? 'Sign in' : 'Renew session'
        alert('Authentication failed. Please try again.')
    }
}

const logoutSession = async (button) => {
    const feedback = document.querySelector('#user-popup-feedback')
    button.disabled = true
    button.textContent = 'Signing out...'
    try {
        const res = await fetch('/api/logout', { method: 'POST' })
        const result = await res.json().catch(() => ({}))
        if (!res.ok || !result.isSuccess) {
            const message = result.message || (res.status === 404
                ? 'Sign-out endpoint unavailable. Restart the OA web server and try again.'
                : `Unable to sign out (${res.status}).`)
            throw new Error(message)
        }
        currentUser = ''
        currentContextData = {}
        currentTenant = ''
        currentEnv = ''
        sessionStatus = 'logged out'
        sessionExpiryMs = null
        refreshTopbar()
        userPopup?.classList.add('hidden')
        userAvatar?.setAttribute('aria-expanded', 'false')
        button.disabled = false
        button.textContent = 'Sign out'
        await loadContext()
    } catch (error) {
        button.disabled = false
        button.textContent = 'Sign out'
        if (feedback) feedback.textContent = error.message || 'Unable to sign out.'
    }
}

const loadContext = async () => {
    try {
        ui.progress({ label: 'Loading Context', value: 20, message: 'Fetching session and environment details...' })
        const res = await fetch('/api/context')
        if (!res.ok) {
            throw new Error('Context endpoint error')
        }
        ui.progress({ value: 60, message: 'Processing application state...' })
        const data = await res.json()
        currentContextData = data
        window.oaContext = data
        pinnedPaths = Array.isArray(data.pinned)
            ? data.pinned.filter((item) => typeof item === 'string' && /^(\$content|\$specs)\/.*\.json$/i.test(item))
            : []
        themeUi.init(data.settings)
        ui.init(data.settings)
        currentEnv = data.env || 'prod'
        currentTenant = data.tenant || ''
        currentUser = data.user || ''
        sessionStatus = String(data.session?.status || '')
        refreshTopbar()
        renderHeaderBreadcrumb()
        refreshTerminalTabLabel()

        const brandLink = document.querySelector('#brand-link')
        if (brandLink && data.web) {
            const token = data.session?.token || ''
            const url = `${data.web.startsWith('http') ? data.web : `https://${data.web}`}?session-token=${token}`
            brandLink.href = url
            brandLink.title = `Open ${data.web} in new tab`
            brandLink.setAttribute('aria-label', `OA CLI, open ${data.web} in a new tab`)
        }

        statusBar.innerHTML = ''
        sessionExpiryMs = data.session?.expiresAt ? new Date(data.session.expiresAt).getTime() : null
        renderSessionTimeLeft()

        ui.progress({ value: 80, message: 'Refreshing Git status...' })
        if (sessionCountdownTimer) {
            window.clearInterval(sessionCountdownTimer)
            sessionCountdownTimer = null
        }

        if (sessionExpiryMs != null) {
            sessionCountdownTimer = window.setInterval(renderSessionTimeLeft, 1000)
            renderSessionTimeLeft()
        }

        currentGitSummary = await gitUi.loadGitStatus() || currentGitSummary
        if (currentSection === 'overview') await contentUi.renderHome(data, currentGitSummary)

        if (!gitRefreshTimer) {
            gitRefreshTimer = window.setInterval(async () => {
                const summary = await gitUi.loadGitStatus()
                if (!summary) return
                currentGitSummary = summary
                if (currentSection === 'overview') {
                    await contentUi.renderHome(currentContextData, currentGitSummary)
                }
            }, 15000)
        }
        ui.progress(false)
    } catch {
        ui.progress(false)
        statusBar.innerHTML = '<span class="status-item"><span class="status-label">Status:</span><span class="status-value">Unable to load context.</span></span>'
    }
}

const init = async () => {
    themeUi.init()
    await contentUi.renderHome(currentContextData, currentGitSummary)
    await loadContext()

    if (headerBreadcrumb) {
        headerBreadcrumb.addEventListener('click', async (event) => {
            const crumb = event.target.closest('[data-crumb-path]')
            if (!crumb) return

            const targetPath = crumb.dataset.crumbPath || ''

            if (!targetPath) {
                await openOverview()
                await renderDirectoryNav('', 'overview')
                return
            }

            if (currentSection === 'data' || currentSection === 'specs') {
                await openDirectory(targetPath, currentSection)
                await renderDirectoryNav(targetPath, currentSection)
                return
            }

            if (currentSection === 'config') {
                await openConfig()
                return
            }

            if (currentSection === 'help') {
                await openHelp()
                return
            }

            if (currentSection === 'changelog') {
                await openChangelog()
                return
            }
        })
    }

    userAvatar?.addEventListener('click', () => {
        const isOpen = userPopup?.classList.toggle('hidden') === false
        userAvatar.setAttribute('aria-expanded', String(isOpen))
        if (isOpen) userPopup?.querySelector('[data-user-action]')?.focus()
    })
    userPopup?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-user-action]')
        if (!button) return
        if (button.dataset.userAction === 'logout') {
            await logoutSession(button)
        } else {
            await renewSession(button)
        }
    })
    document.addEventListener('click', (event) => {
        if (event.target.closest('#user-popup') || event.target.closest('#user-avatar')) return
        userPopup?.classList.add('hidden')
        userAvatar?.setAttribute('aria-expanded', 'false')
    })
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || userPopup?.classList.contains('hidden')) return
        userPopup.classList.add('hidden')
        userAvatar?.setAttribute('aria-expanded', 'false')
        userAvatar?.focus()
    })

    gitUi.ensureGitPopup()
    terminalUi.render()
    activityRail?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-root]')
        if (!button) return
        const root = button.dataset.root
        if (root === currentRoot) {
            if (root === 'logs') {
                await renderMonitLogs()
                return
            }
            if (root === 'monitor') {
                await renderMonitorDashboard()
                return
            }
            isExplorerVisible = !isExplorerVisible
            syncActivityBar()
            return
        }
        currentRoot = root
        isExplorerVisible = true
        syncActivityBar()
        if (root === 'home') {
            await openOverview()
            await renderDirectoryNav('', 'overview')
        } else if (root === 'logs') {
            currentSection = 'logs'
            currentMonitView = ''
            currentPath = ''
            currentSelectedPath = ''
            isExplorerVisible = false
            syncActivityBar()
            syncFragmentState()
            await renderMonitLogs({ page: 0 })
        } else if (root === 'monitor') {
            currentSection = 'monitor'
            currentMonitView = ''
            currentPath = ''
            currentSelectedPath = ''
            isExplorerVisible = false
            syncActivityBar()
            syncFragmentState()
            await renderMonitorDashboard()
        } else if (root === 'data' || root === 'specs') {
            const rootPath = getRootPathForSection(root)
            await openDirectory(rootPath, root)
            await renderDirectoryNav(rootPath, root)
        } else {
            await openConfig()
            await renderDirectoryNav('', 'config')
        }
    })
    document.querySelector('#explorer-collapse')?.addEventListener('click', () => {
        isExplorerVisible = false
        syncActivityBar()
    })
    terminalToggleTab?.addEventListener('click', () => {
        setTerminalVisibility(!isTerminalVisible)
    })

    try {
        const config = await loadConfig()
        const terminalMode = config?.data?.['ux.terminal.mode']
        if (terminalMode === 'collapsed') {
            isTerminalVisible = false
        } else if (terminalMode === 'expanded') {
            isTerminalVisible = true
        }
    } catch {
        // ignore
    }

    const renderFragmentRoute = async (fragmentState) => {
        if (fragmentState.terminal != null) isTerminalVisible = Boolean(fragmentState.terminal)
        if (fragmentState.section !== 'logs') {
            if (logRefreshTimer) clearTimeout(logRefreshTimer)
            logRefreshTimer = null
        }
        if (fragmentState.section !== 'monitor' && fragmentState.monit !== 'conflicts') {
            if (monitorRefreshTimer) clearTimeout(monitorRefreshTimer)
            monitorRefreshTimer = null
        }
        if (fragmentState.monit === 'conflicts') {
            currentMonitView = ''
            currentRoot = 'monitor'
            currentSection = 'monitor'
            await renderMonitorDashboard()
            isExplorerVisible = false
            syncActivityBar()
            setTerminalVisibility(isTerminalVisible, true)
            return
        }
        currentMonitView = ''
        const section = fragmentState.section || 'overview'
        const pathFromHash = fragmentState.path || ''
        if (section === 'data') {
            currentRoot = 'data'
            const root = getRootPathForSection('data')
            const targetPath = pathFromHash || root
            const isJsonFilePath = targetPath.toLowerCase().endsWith('.json')
            const directoryPath = isJsonFilePath && targetPath.includes('/')
                ? targetPath.slice(0, targetPath.lastIndexOf('/'))
                : targetPath
            const selectedPath = isJsonFilePath ? targetPath : ''
            await openDirectory(directoryPath, 'data', selectedPath)
            await renderDirectoryNav(directoryPath, 'data')
        } else if (section === 'specs') {
            currentRoot = 'specs'
            const root = getRootPathForSection('specs')
            const isSpecFilePath = pathFromHash.toLowerCase().endsWith('.json')
            const directoryPath = isSpecFilePath && pathFromHash.includes('/')
                ? pathFromHash.slice(0, pathFromHash.lastIndexOf('/'))
                : pathFromHash || root
            const selectedPath = isSpecFilePath ? pathFromHash : ''
            await openDirectory(directoryPath, 'specs', selectedPath)
            await renderDirectoryNav(directoryPath, 'specs')
        } else if (section === 'logs') {
            currentRoot = 'logs'
            currentSection = 'logs'
            currentPath = ''
            currentSelectedPath = ''
            await renderMonitLogs()
        } else if (section === 'monitor') {
            currentRoot = 'monitor'
            currentSection = 'monitor'
            currentPath = ''
            currentSelectedPath = ''
            await renderMonitorDashboard()
        } else if (section === 'config') {
            currentRoot = 'preferences'
            await openConfig()
            await renderDirectoryNav('', 'config')
        } else if (section === 'context') {
            currentRoot = 'home'
            await openContext()
            await renderDirectoryNav('', 'context')
        } else if (section === 'help') {
            currentRoot = 'home'
            await openHelp()
            await renderDirectoryNav('', 'help')
        } else if (section === 'changelog') {
            currentRoot = 'home'
            await openChangelog()
            await renderDirectoryNav('', 'changelog')
        } else if (section === 'pinned') {
            currentRoot = 'data'
            await openPinned()
            await renderDirectoryNav('', 'pinned')
        } else {
            currentRoot = 'home'
            await openOverview()
            await renderDirectoryNav('', 'overview')
        }

        isExplorerVisible = !['logs', 'monitor'].includes(section)
        syncActivityBar()
        setTerminalVisibility(isTerminalVisible, true)
    }

    const renderMonitorDashboard = async () => {
        if (monitorRefreshTimer) clearTimeout(monitorRefreshTimer)
        monitorRefreshTimer = null
        mainContent.innerHTML = '<section class="card monit-dashboard"><h1>Monitor</h1><p class="summary">Loading monitor status and queue…</p></section>'
        try {
            const response = await fetch('/api/monit')
            const payload = await response.json()
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to load monitor records.')
            const status = payload.status
            const formatTime = (value) => {
                if (!value) return 'Not available'
                const date = new Date(value)
                return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
            }
            const conflictRows = (payload.conflicts || []).map((item) => {
                const viewerPath = item.contentPath || `$content/${String(item.path || '').replace(/\\/g, '/').split('/data/').pop()}`
                const href = `#section=data&path=${encodeURIComponent(viewerPath)}`
                return `<tr><td><a href="${escapeHtml(href)}">${escapeHtml(item.relativePath || item.path)}</a></td><td>${escapeHtml(item.reason || 'Conflict')}</td><td>${escapeHtml(item.detectedAt || '')}</td></tr>`
            }).join('')
            const renderQueueItem = (item) => {
                const approval = item.kind === 'new-file'
                    ? `<code>oa monit "${escapeHtml(item.monitorFolder || 'data')}" --approve "${escapeHtml(item.relativePath || '')}"</code>`
                    : '<span>Push is automatic at the next configured push interval.</span>'
                const relativeFile = String(item.relativePath || '').replace(/\\/g, '/')
                const contentPath = relativeFile.startsWith('data/') ? `$content/${relativeFile.slice('data/'.length)}` : ''
                const openFile = contentPath
                    ? `<a class="monit-task-link" href="#section=data&path=${encodeURIComponent(contentPath)}">Open file</a>`
                    : '<span class="monit-task-link is-disabled">File path unavailable</span>'
                const approveAction = item.kind === 'new-file' && item.status === 'awaiting-approval'
                    ? `<button type="button" class="monit-approve-button" data-monitor-approve="${escapeHtml(item.relativePath || '')}">Approve and push full file</button>`
                    : ''
                const summary = item.summary || item.message || (item.kind === 'new-file'
                    ? 'New local file; no remote write will happen until it is approved.'
                    : item.kind === 'push'
                        ? 'Validated local changes are queued for a full-file push.'
                        : 'Review this queued monitor task.')
                const details = { ...item }
                delete details.suggestedRemote
                return `<details class="monit-queue-item"><summary><span class="monit-queue-file"><strong>${escapeHtml(item.relativePath || item.path)}</strong><small>${escapeHtml(summary)}</small></span><span class="monit-queue-kind">${escapeHtml(item.kind || 'task')}</span><span class="monit-task-status">${escapeHtml(item.status || 'queued')}</span><span class="monit-queue-time">${escapeHtml(formatTime(item.detectedAt || item.queuedAt))}</span><span class="monit-expand-label">Details</span></summary><div class="monit-queue-details"><div><h4>Task summary</h4><p>${escapeHtml(summary)}</p><dl><div><dt>Task</dt><dd>${escapeHtml(item.kind || 'task')}</dd></div><div><dt>Status</dt><dd>${escapeHtml(item.status || 'queued')}</dd></div><div><dt>Queued</dt><dd>${escapeHtml(formatTime(item.detectedAt || item.queuedAt))}</dd></div></dl><div class="monit-task-actions">${openFile}${approveAction}</div></div><div><h4>Remote mapping and action</h4><pre class="monit-meta">${escapeHtml(JSON.stringify(item.suggestedRemote || {}, null, 2))}</pre>${approval}</div><details class="monit-raw-details"><summary>Raw task record</summary><pre class="monit-meta">${escapeHtml(JSON.stringify(details, null, 2))}</pre></details></div></details>`
            }
            const queueGroups = new Map()
            for (const item of payload.pending || []) {
                const key = String(item.status || 'queued').trim().toLowerCase() || 'queued'
                if (!queueGroups.has(key)) queueGroups.set(key, [])
                queueGroups.get(key).push(item)
            }
            const statusLabel = (status) => ({
                'awaiting-approval': 'Awaiting approval',
                queued: 'Queued',
                processing: 'Processing',
                blocked: 'Blocked',
                failed: 'Failed'
            })[status] || status.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
            const queueItems = [...queueGroups.entries()]
                .sort(([a], [b]) => statusLabel(a).localeCompare(statusLabel(b)))
                .map(([status, items]) => `<section class="monit-queue-group" aria-label="${escapeHtml(statusLabel(status))}: ${items.length} tasks"><header><h3>${escapeHtml(statusLabel(status))}</h3><span>${items.length} ${items.length === 1 ? 'task' : 'tasks'}</span></header><div class="monit-queue-group-items">${items.map(renderQueueItem).join('')}</div></section>`)
                .join('')
            const queueCount = payload.pending?.length || 0
            const countForStatus = (status) => queueGroups.get(status)?.length || 0
            const statusBreakdown = ['awaiting-approval', 'queued', 'processing', 'blocked', 'failed']
                .map((status) => `<span>${escapeHtml(statusLabel(status))}<b>${countForStatus(status)}</b></span>`)
                .join('')
            const readyTaskCount = (payload.pending || []).filter((item) => (item.kind === 'push' && item.status === 'queued')
                || (item.kind === 'new-file' && item.status === 'awaiting-approval')).length
            mainContent.innerHTML = `
                <section class="card monit-dashboard">
                    <header class="monit-dashboard-header"><div><p class="monit-eyebrow">REMOTE SYNC</p><h1>Monitor</h1><p class="summary">Track the active folder, scheduled runs, pending work, and conflicts.</p></div><div class="monit-dashboard-actions"><label class="monit-auto-refresh"><input type="checkbox" data-monitor-auto-refresh ${monitorAutoRefreshEnabled ? 'checked' : ''}><span class="monit-switch" aria-hidden="true"></span><span>Auto refresh</span></label><button type="button" class="btn-secondary" data-monitor-flush ${readyTaskCount ? '' : 'disabled'} ${readyTaskCount ? '' : 'aria-disabled="true"'}>Flush queue <span class="monit-flush-count">${readyTaskCount}</span></button><a class="btn-secondary" href="#section=logs&terminal=${isTerminalVisible ? '1' : '0'}">View logs</a><button type="button" class="btn-secondary" data-monitor-refresh><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 6V2m0 4h-4M4 14v4m0-4h4"/><path d="M5.2 7a5.5 5.5 0 0 1 9-1L16 8M4 12l1.8 2a5.5 5.5 0 0 0 9-1"/></svg>Refresh</button></div></header>
                    <section class="monit-status-panel" aria-labelledby="monit-status-title">
                        <header class="monit-section-heading"><div><p class="monit-eyebrow">SYNC STATUS</p><h2 id="monit-status-title">Schedule</h2></div><span class="monit-running-badge ${status?.active ? 'is-active' : ''}"><span aria-hidden="true"></span>${status?.active ? 'Running' : 'Not running'}</span></header>
                        <div class="monit-status-grid">
                            <div class="monit-folder-stat"><span>Monitoring</span><strong>${escapeHtml(status?.folder || 'No folder recorded')}</strong></div>
                            <div class="monit-queue-stat"><span>Tasks in queue</span><strong>${queueCount}</strong><small class="monit-queue-status-counts">${statusBreakdown}</small></div>
                            <div><span>Last completed scan</span><strong>${escapeHtml(formatTime(status?.lastRunAt))}</strong></div>
                            <div><span>Next scheduled run</span><strong>${escapeHtml(status?.active ? formatTime(status.nextRunAt) : '—')}</strong></div>
                        </div>
                    </section>
                    <section class="monit-dashboard-section" aria-labelledby="monit-queue-title">
                        <header class="monit-section-heading"><div><p class="monit-eyebrow">PENDING WORK</p><h2 id="monit-queue-title">Queue</h2></div></header>
                        <p class="summary">Expand a task to review its summary, remote mapping, and approval details.</p>
                        <p class="monit-feedback" data-monitor-feedback aria-live="polite"></p>
                        <div class="monit-queue-list">${queueItems || '<p class="monit-empty-row">Queue is clear. No pending tasks.</p>'}</div>
                    </section>
                    <section class="monit-dashboard-section" aria-labelledby="monit-conflicts-title">
                        <header class="monit-section-heading"><div><p class="monit-eyebrow">NEEDS ATTENTION</p><h2 id="monit-conflicts-title">Conflicts</h2></div><span class="monit-queue-count">${payload.conflicts?.length || 0}</span></header>
                        <p class="summary">Open a file to compare local and remote content. Conflict records are stored in the file metadata.</p>
                        <div class="table-scroll monit-queue-table"><table><thead><tr><th>File</th><th>Reason</th><th>Detected</th></tr></thead><tbody>${conflictRows || '<tr><td colspan="3" class="monit-empty-row">No unresolved conflicts.</td></tr>'}</tbody></table></div>
                    </section>
                </section>`
            mainContent.querySelector('[data-monitor-refresh]')?.addEventListener('click', renderMonitorDashboard)
            mainContent.querySelector('[data-monitor-flush]')?.addEventListener('click', async (event) => {
                const button = event.currentTarget
                if (!readyTaskCount) return
                if (!window.confirm(`Flush ${readyTaskCount} queue task${readyTaskCount === 1 ? '' : 's'} now? This approves and pushes complete files awaiting approval, and processes queued full-file pushes. Schema validation runs before each push.`)) return
                button.disabled = true
                const feedback = mainContent.querySelector('[data-monitor-feedback]')
                if (feedback) feedback.textContent = 'Flushing queue tasks…'
                try {
                    const flushResponse = await fetch('/api/monit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'flush' }) })
                    const result = await flushResponse.json()
                    if (!flushResponse.ok || !result.ok) throw new Error(result.error || 'Queue flush failed.')
                    await renderMonitorDashboard()
                    const refreshedFeedback = mainContent.querySelector('[data-monitor-feedback]')
                    if (refreshedFeedback) refreshedFeedback.textContent = result.message || `Processed ${result.processed || 0} ready task${result.processed === 1 ? '' : 's'}.`
                } catch (error) {
                    button.disabled = false
                    if (feedback) feedback.textContent = error.message || 'Queue flush failed.'
                }
            })
            mainContent.querySelectorAll('[data-monitor-approve]').forEach((button) => button.addEventListener('click', async () => {
                const filePath = button.dataset.monitorApprove
                if (!window.confirm(`Approve and push the complete local file to its mapped remote resource?\n\n${filePath}`)) return
                button.disabled = true
                const feedback = mainContent.querySelector('[data-monitor-feedback]')
                if (feedback) feedback.textContent = `Approving and pushing ${filePath}…`
                try {
                    const approvalResponse = await fetch('/api/monit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'approve', path: filePath })
                    })
                    const approvalResult = await approvalResponse.json()
                    if (!approvalResponse.ok || !approvalResult.ok) throw new Error(approvalResult.error || 'Approval failed.')
                    await renderMonitorDashboard()
                    const refreshedFeedback = mainContent.querySelector('[data-monitor-feedback]')
                    if (refreshedFeedback) refreshedFeedback.textContent = `Approved and pushed the full file: ${filePath}`
                } catch (error) {
                    button.disabled = false
                    if (feedback) feedback.textContent = error.message || 'Approval failed.'
                }
            }))
            mainContent.querySelector('[data-monitor-auto-refresh]')?.addEventListener('change', (event) => {
                monitorAutoRefreshEnabled = event.target.checked
                try { localStorage.setItem('oa.monitor.autoRefresh', String(monitorAutoRefreshEnabled)) } catch { /* preference is session-only */ }
                renderMonitorDashboard()
            })
            if (monitorAutoRefreshEnabled && currentSection === 'monitor') {
                monitorRefreshTimer = setTimeout(renderMonitorDashboard, 30000)
            }
        } catch (error) {
            mainContent.innerHTML = `<section class="card monit-dashboard"><h1>Monitor</h1><p class="summary">${escapeHtml(error.message)}</p></section>`
        }
    }

    window.addEventListener('popstate', async () => {
        isRestoringHistory = true
        try {
            await renderFragmentRoute(parseFragmentState())
        } finally {
            isRestoringHistory = false
        }
    })
    window.addEventListener('hashchange', async () => {
        isRestoringHistory = true
        try { await renderFragmentRoute(parseFragmentState()) }
        finally { isRestoringHistory = false }
    })

    await renderFragmentRoute(parseFragmentState())
    hasInitializedRoute = true
    gitUi.bindStatusBarToggle()
}

init()
