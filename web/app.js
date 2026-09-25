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
let currentSection = 'overview'
let currentRoot = 'home'
let isExplorerVisible = true
let currentEnv = 'prod'
let currentTenant = ''
let currentUser = ''
let currentGitSummary = {}
let currentContextData = { role: '', application: '', organization: '', session: { remainingMs: null } }
let isTerminalVisible = true
let pinnedPaths = []
let currentConfigPayload = { data: {} }
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

const cardCommands = commands.filter((cmd) => ['init', 'validate', 'pull', 'push', 'script', 'config', 'context', 'test'].includes(cmd.name))
const commandIcons = {
    init: '\u26A1',
    validate: '\u2611',
    pull: '\u2B07',
    push: '\u2B06',
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

    if (currentSection === 'overview') {
        headerBreadcrumb.innerHTML = '<span>overview</span>'
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
    return {
        section,
        path,
        terminal: terminal == null ? null : terminal !== '0'
    }
}

const syncFragmentState = () => {
    const params = new URLSearchParams()
    params.set('section', currentSection || 'overview')
    if (currentPath) params.set('path', currentPath)
    params.set('terminal', isTerminalVisible ? '1' : '0')
    const next = `#${params.toString()}`
    if (window.location.hash !== next) {
        window.history.replaceState(null, '', next)
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

const terminalUi = createTerminalUi({
    terminalHost,
    getPendingCommand: () => pendingTerminalCommand,
    setPendingCommand: (value) => {
        pendingTerminalCommand = value
    },
    onExecute: async (command) => {
        const res = await fetch('/api/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        })
        return res.json()
    }
})

const contentUi = createContentUi({
    mainContent,
    cardCommands,
    commandIcons,
    onUseCommand: (command) => terminalUi.setCommand(command),
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

const saveMeta = async ({ path, metaFile, meta, schemaType }) => {
    const res = await fetch('/api/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, metaFile, meta, schemaType })
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

    const fragmentState = parseFragmentState()
    if (fragmentState.terminal != null) {
        isTerminalVisible = Boolean(fragmentState.terminal)
    }

    const section = fragmentState.section || 'overview'
    const pathFromHash = fragmentState.path || ''
    if (section === 'data') {
        const root = getRootPathForSection('data')
        await openDirectory(pathFromHash || root, 'data')
        await renderDirectoryNav(pathFromHash || root, 'data')
    } else if (section === 'specs') {
        const root = getRootPathForSection('specs')
        await openDirectory(pathFromHash || root, 'specs')
        await renderDirectoryNav(pathFromHash || root, 'specs')
    } else if (section === 'config') {
        await openConfig()
        await renderDirectoryNav('', 'config')
    } else if (section === 'context') {
        await openContext()
        await renderDirectoryNav('', 'context')
    } else if (section === 'help') {
        await openHelp()
        await renderDirectoryNav('', 'help')
    } else if (section === 'changelog') {
        await openChangelog()
        await renderDirectoryNav('', 'changelog')
    } else if (section === 'pinned') {
        await openPinned()
        await renderDirectoryNav('', 'pinned')
    } else {
        await openOverview()
        await renderDirectoryNav('', 'overview')
    }

    isExplorerVisible = true
    syncActivityBar()
    gitUi.bindStatusBarToggle()
    setTerminalVisibility(isTerminalVisible, true)
}

init()
