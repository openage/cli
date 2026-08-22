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
const headerBreadcrumb = document.querySelector('#header-breadcrumb')

let sessionCountdownTimer = null
let sessionExpiryMs = null
let sessionStatus = ''
let gitRefreshTimer = null
let pendingTerminalCommand = 'oa pull'
let currentPath = ''
let currentSection = 'overview'
let currentEnv = 'prod'
let currentTenant = ''
let currentUser = ''
let isTerminalVisible = true
let pinnedPaths = []

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
    if (section === 'pinned') return 'Pinned'
    return 'Overview'
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
    if (userAvatar) {
        const source = String(currentUser || 'oa').trim()
        const initials = source
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((token) => token[0]?.toUpperCase() || '')
            .join('') || 'OA'
        userAvatar.textContent = initials
        userAvatar.title = source || 'Current user'
    }
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
    terminalToggleTab.textContent = `${isTerminalVisible ? 'x' : '>_'}`
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
    refreshTopbar()
    renderHeaderBreadcrumb()
    await contentUi.renderHome()
    syncFragmentState()
}

const openHelp = async () => {
    currentPath = ''
    currentSection = 'help'
    refreshTopbar()
    renderHeaderBreadcrumb()
    await contentUi.renderHelp()
    syncFragmentState()
}

const openContext = async () => {
    currentPath = ''
    currentSection = 'context'
    refreshTopbar()
    renderHeaderBreadcrumb()
    const res = await fetch('/api/context')
    const data = await res.json()
    await contentUi.renderContext(data)
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
    refreshTopbar()
    renderHeaderBreadcrumb()
    ui.progress({ label: 'Loading Config', value: 40, message: 'Reading settings from disk...' })
    const payload = await loadConfig()
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
            saveMeta: async (payloadToSave) => saveMeta(payloadToSave),
            loadGitDiff: async (targetPath) => loadGitDiff(targetPath),
            loadEntries: async (targetPath) => loadDirectoryEntries(targetPath),
            selectedPath
        }
    )
    ui.progress(false)
    syncFragmentState()
}

const renderDirectoryNav = async (path = currentPath, section = currentSection) => {
    try {
        const rootPath = getRootPathForSection(section)
        const showFolderRows = section === 'data' || section === 'specs'
        const activePath = path || rootPath
        let entries = []
        if (showFolderRows) {
            entries = await loadDirectoryEntries(activePath)
        }

        const parentPath = (() => {
            if (!showFolderRows || !activePath || activePath === rootPath) return ''
            const normalized = activePath.endsWith('/') ? activePath.slice(0, -1) : activePath
            const slashIndex = normalized.lastIndexOf('/')
            if (slashIndex <= 0) return rootPath
            const candidate = normalized.slice(0, slashIndex)
            return candidate || rootPath
        })()

        const folderRows = entries
            .filter((entry) => entry.type === 'directory')
            .map((entry) => {
                const fullPath = activePath ? `${activePath}/${entry.name}` : entry.name
                return `<button type="button" class="nav-link dir-item is-directory" data-section="${section}" data-dir-path="${fullPath}"><span class="dir-icon" aria-hidden="true"></span><span class="dir-name">${entry.name}</span></button>`
            }).join('')

        dirList.innerHTML = `
          <div class="nav-group">
            <h4>OPERATIONS</h4>
            <button type="button" class="nav-link ${section === 'overview' ? 'is-active' : ''}" data-page="overview">Home</button>
            <button type="button" class="nav-link ${section === 'data' ? 'is-active' : ''}" data-page="data">Data</button>
            ${section === 'data' ? `
              ${activePath !== rootPath ? `<button type="button" class="nav-link" data-section="data" data-dir-path="${parentPath}">..</button>` : ''}
              ${folderRows || '<p class="summary">No folders</p>'}
            ` : ''}
            <button type="button" class="nav-link ${section === 'specs' ? 'is-active' : ''}" data-page="specs">Specs</button>
            ${section === 'specs' ? `
              ${activePath !== rootPath ? `<button type="button" class="nav-link" data-section="specs" data-dir-path="${parentPath}">..</button>` : ''}
              ${folderRows || '<p class="summary">No folders</p>'}
            ` : ''}
            <button type="button" class="nav-link ${section === 'pinned' ? 'is-active' : ''}" data-page="pinned">Pinned</button>
          </div>
          
          <div class="nav-group">
            <h4>SYSTEM</h4>
            <button type="button" class="nav-link ${section === 'config' ? 'is-active' : ''}" data-page="config">Open Config</button>
            <button type="button" class="nav-link ${section === 'context' ? 'is-active' : ''}" data-page="context">Open Context</button>
            <button type="button" class="nav-link ${section === 'help' ? 'is-active' : ''}" data-page="help">Help</button>
          </div>
        `

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
    const sessionLeft = statusBar.querySelector('[data-context-key="sessionRemaining"]')
    if (!sessionLeft) return

    const remaining = sessionExpiryMs == null ? null : Math.max(0, sessionExpiryMs - Date.now())
    sessionLeft.textContent = formatRemaining(remaining)
    const statusItem = sessionLeft.closest('.status-item')
    const existingButton = statusItem?.querySelector('[data-renew-session]')
    const isExpired = (remaining !== null && remaining <= 0) || sessionStatus.toLowerCase() === 'expired'
    if (isExpired) {
        if (!existingButton) {
            const renewButton = document.createElement('button')
            renewButton.type = 'button'
            renewButton.className = 'status-item-button'
            renewButton.dataset.renewSession = 'true'
            renewButton.textContent = 'Renew'
            statusItem?.appendChild(renewButton)
        }
    } else {
        existingButton?.remove()
    }
}

const renewSession = async (button) => {
    button.disabled = true
    button.textContent = 'Renewing...'
    try {
        const res = await fetch('/api/auth/renew', { method: 'POST' })
        if (!res.ok) throw new Error('Authentication failed')
        await loadContext()
    } catch {
        button.disabled = false
        button.textContent = 'Renew'
        alert('Authentication failed. Please try again.')
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

        const brandArea = document.querySelector('.brand > div')
        if (brandArea && data.web) {
            const token = data.session?.token || ''
            const url = `${data.web.startsWith('http') ? data.web : `https://${data.web}`}?session-token=${token}`
            brandArea.innerHTML = `<strong>OA CLI</strong><br /><a href="${url}" target="_blank" class="brand-host" title="Open ${data.web} in new tab">${data.web}</a>`
        }

        statusBar.innerHTML = ''
        sessionExpiryMs = data.session?.expiresAt ? new Date(data.session.expiresAt).getTime() : null
        renderStatusItem('Session Left', formatRemaining(data.session?.remainingMs), 'sessionRemaining')

        ui.progress({ value: 80, message: 'Refreshing Git status...' })
        if (sessionCountdownTimer) {
            window.clearInterval(sessionCountdownTimer)
            sessionCountdownTimer = null
        }

        if (sessionExpiryMs != null) {
            sessionCountdownTimer = window.setInterval(renderSessionTimeLeft, 1000)
            renderSessionTimeLeft()
        }

        await gitUi.loadGitStatus()

        if (!gitRefreshTimer) {
            gitRefreshTimer = window.setInterval(() => {
                gitUi.loadGitStatus()
            }, 15000)
        }
        ui.progress(false)
    } catch {
        ui.progress(false)
        statusBar.innerHTML = '<span class="status-item"><span class="status-label">Status:</span><span class="status-value">Unable to load context.</span></span>'
    }
}

const init = async () => {
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
        })
    }

    statusBar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-renew-session]')
        if (button) renewSession(button)
    })

    gitUi.ensureGitPopup()
    terminalUi.render()
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
    } else if (section === 'pinned') {
        await openPinned()
        await renderDirectoryNav('', 'pinned')
    } else {
        await openOverview()
        await renderDirectoryNav('', 'overview')
    }

    gitUi.bindStatusBarToggle()
    setTerminalVisibility(isTerminalVisible, true)
}

init()
