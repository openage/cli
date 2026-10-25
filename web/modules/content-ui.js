import { renderExamples } from './templates.js'
import { copyText, buildAbsoluteUrl, getFileIcon, escapeHtml } from './utils.js'
import { createDiffViewer } from './diff-viewer.js'

const renderGitDiff = (source) => String(source || '').split(/\r?\n/).map((line) => {
    let kind = 'context'
    if (/^\+\+\+|^---/.test(line)) kind = 'file'
    else if (/^\+/.test(line)) kind = 'added'
    else if (/^-/.test(line)) kind = 'removed'
    else if (/^@@/.test(line)) kind = 'hunk'
    else if (/^(diff --git|index |new file mode|deleted file mode|similarity index)/.test(line)) kind = 'meta'
    return `<span class="git-diff-line git-diff-line--${kind}">${escapeHtml(line) || '&nbsp;'}</span>`
}).join('')

export const createContentUi = ({ mainContent, cardCommands, commandIcons, onUseCommand, onRunSpecCommand, onAddLocalPath, isPinned, onTogglePin }) => {
    const sectionTemplateCache = new Map()
    let settingsMeta = null
    let specRunResults = {}
    try { specRunResults = JSON.parse(localStorage.getItem('oa.spec.lastRuns') || '{}') } catch { /* ignore invalid saved results */ }

    const normalizeSpecPath = (value) => String(value || '').replace(/\\/g, '/').replace(/^\$specs\//, '').replace(/^\.\/specs\//, '').replace(/^specs\//, '')
    const specPathFromCommand = (command) => {
        const match = String(command || '').match(/(?:\.\/)?specs[\\/]([^\s"']+\.json)/i)
        return match ? normalizeSpecPath(match[1]) : ''
    }

    const renderSpecRunResult = (result) => {
        if (!result) return '<p class="summary">No test run recorded yet. Run Test or Validate for this specification.</p>'
        const passed = Number(result.code) === 0
        const stripAnsi = (text) => String(text || '').replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g, '')
        const stdout = stripAnsi(result.stdout).trim()
        const stderr = stripAnsi(result.stderr).trim()
        const outputLines = stdout.split(/\r?\n/)
        const resultHeading = outputLines.findIndex((line) => /^\s*Result\s*$/i.test(line))
        let resultTable = ''
        let outputDetails = stdout
        if (resultHeading >= 0) {
            const parsedRows = outputLines.slice(resultHeading + 1).map((line) => line.trim()).filter((line) => /[|│]/.test(line)).map((line) => line.split(/[|│]/).slice(1, -1).map((cell) => cell.trim())).filter((cells) => cells.length >= 4 && cells.some(Boolean))
            const headers = parsedRows.find((cells) => /^result$/i.test(cells[0]))
            const rows = parsedRows.filter((cells) => cells !== headers && /(?:PASS|FAIL|UNKNOWN)/i.test(cells[0]))
            if (headers && rows.length) {
                resultTable = `<section class="spec-run-output spec-run-validations"><h4>Validation results</h4><div class="spec-run-table-wrap"><table><thead><tr>${headers.slice(0, 4).map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((cells) => `<tr class="${/PASS/i.test(cells[0]) ? 'is-pass' : /FAIL/i.test(cells[0]) ? 'is-fail' : 'is-unknown'}">${cells.slice(0, 4).map((cell, index) => `<td>${index === 0 ? `<strong>${escapeHtml(cell)}</strong>` : escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`
                outputDetails = outputLines.slice(0, resultHeading).join('\n').trim()
            }
        }
        return `<div class="spec-run-result ${passed ? 'is-success' : 'is-failure'}"><p><strong>${passed ? 'Passed' : 'Failed'}</strong><time>${escapeHtml(new Date(result.at).toLocaleString())}</time></p><div class="spec-run-command"><span>Command</span><code>${escapeHtml(result.command || '')}</code></div>${resultTable}${outputDetails ? `<section class="spec-run-output"><h4>${resultTable ? 'Response details' : 'Output'}</h4><pre>${escapeHtml(outputDetails)}</pre></section>` : ''}${stderr ? `<section class="spec-run-output spec-run-stderr"><h4>Error output</h4><pre>${escapeHtml(stderr)}</pre></section>` : ''}${!stdout && !stderr ? `<p class="summary">Command exited with code ${escapeHtml(result.code)}.</p>` : ''}</div>`
    }

    const loadSettingsMeta = async () => {
        if (settingsMeta) return settingsMeta
        settingsMeta = {}
        try {
            const res = await fetch('/api/config-metadata')
            if (res.ok) {
                const body = await res.json()
                const list = body.data || []
                list.forEach((item) => {
                    if (!item.code) return
                    settingsMeta[item.code] = {
                        label: item.message || item.code,
                        type: item.type === 'list' ? 'options' : (item.type === 'confirm' ? 'boolean' : item.type),
                        options: (item.choices || []).map((c) => (typeof c === 'object' ? c : { name: c, value: c }))
                    }
                })
            }
        } catch {
            // ignore
        }
        return settingsMeta
    }

    const loadSectionTemplate = async (sectionName) => {
        if (sectionTemplateCache.has(sectionName)) {
            return sectionTemplateCache.get(sectionName)
        }

        const res = await fetch(`/htmls/sections/${sectionName}.html`)
        if (!res.ok) {
            throw new Error(`Unable to load section template: ${sectionName}`)
        }

        const html = await res.text()
        sectionTemplateCache.set(sectionName, html)
        return html
    }

    const renderSectionTemplate = async (sectionName, placeholders = {}) => {
        let template = await loadSectionTemplate(sectionName)
        Object.entries(placeholders).forEach(([key, value]) => {
            const token = `{{${key}}}`
            template = template.split(token).join(value ?? '')
        })
        return template
    }

    const getGitStatusGlyph = (status) => {
        const value = String(status || 'clean').toLowerCase()
        if (value === 'clean') return '✓'
        if (value === 'staged') return 'S'
        if (value === 'modified') return 'M'
        if (value === 'untracked') return 'U'
        if (value === 'staged+modified') return '±'
        return '•'
    }

    const buildCommandCards = () => {
        return cardCommands.map((cmd, index) => {
            const detailsId = `card-detail-${index}`
            return `
              <article class="command-card">
                <button type="button" class="command-card-toggle" data-toggle-details="${detailsId}" aria-expanded="false" aria-controls="${detailsId}">
                  <span class="command-icon" aria-hidden="true">${commandIcons[cmd.name] || '\\u25A1'}</span>
                  <span class="command-head">
                    <strong>${escapeHtml(cmd.title)}</strong>
                    <span>${escapeHtml(cmd.overview)}</span>
                  </span>
                </button>
                <div id="${detailsId}" class="command-details" hidden>
                  <div class="section"><h3>Key Concepts</h3><ul class="content-list">${cmd.keyConcepts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
                  <div class="section"><h3>Options</h3><ul class="content-list">${cmd.options.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
                  <div class="section"><h3>Examples</h3><ul class="content-list example-list">${renderExamples(cmd.examples, escapeHtml)}</ul></div>
                </div>
              </article>
            `
        }).join('')
    }

    const renderHome = async (contextData = {}, gitSummary = {}) => {
        const session = contextData.session || {}
        const homeStatus = `
                    <section class="home-status" aria-label="Current status">
                        <div><span>Session</span><strong>${escapeHtml(session.status || 'Unknown')}</strong><small>${escapeHtml(session.remainingMs != null ? `${Math.max(0, Math.floor(session.remainingMs / 1000))}s remaining` : 'Remaining time unavailable')}</small></div>
                        <div><span>Workspace</span><strong>${escapeHtml(contextData.tenant || 'No tenant')}</strong><small>${escapeHtml(String(contextData.env || 'prod').toUpperCase())} environment</small></div>
                        <div><span>Current User</span><strong>${escapeHtml(contextData.user || 'Not signed in')}</strong><small>${escapeHtml(contextData.role || 'No role')}</small></div>
                        <div><span>Git</span><strong>${escapeHtml(gitSummary.branch || 'Unavailable')}</strong><small>${escapeHtml(`${gitSummary.totalChanged ?? 0} changed, ${gitSummary.stagedCount ?? 0} staged`)}</small></div>
                    </section>
                `
        mainContent.innerHTML = await renderSectionTemplate('overview', {
            COMMAND_CARDS: buildCommandCards(),
            HOME_STATUS: homeStatus
        })

        mainContent.onclick = async (event) => {
            const useBtn = event.target.closest('[data-use-example]')
            if (useBtn) {
                onUseCommand(useBtn.dataset.useExample)
                return
            }

            const copyBtn = event.target.closest('[data-copy-example]')
            if (copyBtn) {
                await copyText(copyBtn.dataset.copyExample, copyBtn)
                return
            }

            const toggle = event.target.closest('[data-toggle-details]')
            if (!toggle) return

            const details = document.getElementById(toggle.dataset.toggleDetails)
            if (!details) return

            const isExpanded = toggle.getAttribute('aria-expanded') === 'true'
            const allToggles = mainContent.querySelectorAll('[data-toggle-details]')
            allToggles.forEach((item) => {
                const itemDetails = document.getElementById(item.dataset.toggleDetails)
                const card = item.closest('.command-card')
                if (!itemDetails || !card) return
                item.setAttribute('aria-expanded', 'false')
                itemDetails.hidden = true
                card.classList.remove('is-open')
            })

            if (!isExpanded) {
                toggle.setAttribute('aria-expanded', 'true')
                details.hidden = false
                toggle.closest('.command-card').classList.add('is-open')
            }
        }
    }

    const renderDirectoryContent = async (path, entries, onOpenFolder, onOpenCrumb, onRefreshNav, metaSupport = {}) => {
        const folderWebPath = `/${path || ''}`.replace(/\/+$/, '') || '/'
        const isMetaEnabled = Boolean(metaSupport.enabled)
        const rootKind = metaSupport.section === 'specs' ? 'specs' : 'content'
        let activeFolderContents = entries
        let activeRemoteListing = rootKind === 'content' && metaSupport.loadRemoteDirectory
            ? await metaSupport.loadRemoteDirectory(path)
            : null

        const getCommandsForEntry = (entry) => {
            const rel = String(entry?.cwdRelativePath || '').trim()
            const localArg = rel ? ` --local ./${rel}` : ''
            if (rootKind === 'specs') {
                return {
                    primary: `oa test${localArg}`,
                    secondary: `oa test${localArg}`
                }
            }
            return {
                primary: `oa pull${localArg}`,
                secondary: `oa push${localArg}`
            }
        }

        const getSelectedRowClass = (selectedPath, rowPath) => (selectedPath && selectedPath === rowPath ? ' is-selected' : '')

        const folderSummary = {
            type: 'directory',
            name: path ? path.split('/').filter(Boolean).at(-1) : (rootKind === 'specs' ? '$specs' : '$content'),
            path,
            webPath: folderWebPath,
            gitStatus: 'clean',
            cwdRelativePath: '',
            fileCount: entries.filter((entry) => entry.type === 'file').length
        }

        const renderRows = (selectedPath = '') => {
            return entries.map((entry) => {
                const nextPath = path ? `${path}/${entry.name}` : entry.name
                if (entry.type === 'directory') {
                    return `
                      <article class="dir-row card is-directory-card${getSelectedRowClass(selectedPath, nextPath)}" data-select-path="${escapeHtml(nextPath)}" data-entry-type="directory" data-web-path="${escapeHtml(entry.webPath || '')}" data-git-status="${escapeHtml(entry.gitStatus || 'clean')}" data-cwd-relative="${escapeHtml(entry.cwdRelativePath || '')}">
                        <div class="file-row-main">
                          <span class="file-icon folder-icon" aria-hidden="true"></span>
                          <button type="button" class="folder-open-link" data-open-path="${escapeHtml(nextPath)}">${escapeHtml(entry.name)}</button>
                        </div>
                        <div class="file-actions">
                          <span class="icon-btn git-status status-${escapeHtml(entry.gitStatus || 'clean')}" title="Git: ${escapeHtml(entry.gitStatus || 'clean')}" aria-label="Git status">${escapeHtml(getGitStatusGlyph(entry.gitStatus))}</span>
                        </div>
                      </article>
                    `
                }

                return `
                  <article class="dir-row card is-file${getSelectedRowClass(selectedPath, nextPath)}" data-select-path="${escapeHtml(nextPath)}" data-entry-type="file" data-web-path="${escapeHtml(entry.webPath || '')}" data-git-status="${escapeHtml(entry.gitStatus || 'clean')}" data-cwd-relative="${escapeHtml(entry.cwdRelativePath || '')}">
                    <div class="file-row-main">
                      <span class="file-icon">${escapeHtml(getFileIcon(entry.name))}</span>
                      <a class="file-name file-link" href="${escapeHtml(entry.webPath || '#')}" title="Open ${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</a>
                    </div>
                    <div class="file-actions">
                      <span class="icon-btn git-status status-${escapeHtml(entry.gitStatus || 'clean')}" title="Git: ${escapeHtml(entry.gitStatus || 'clean')}" aria-label="Git status">${escapeHtml(getGitStatusGlyph(entry.gitStatus))}</span>
                    </div>
                  </article>
                `
            }).join('')
        }

        const rootMeta = isMetaEnabled && metaSupport.payload
            ? metaSupport.payload
            : (isMetaEnabled && metaSupport.loadMeta ? await metaSupport.loadMeta(path || (rootKind === 'specs' ? '$specs' : '$content')) : null)

        const renderDetails = (entry, metaPayload, diffText = '', fileCount = null, fileContent = '', remoteContent = '', remoteError = '', remoteExists = null) => {
            const commands = getCommandsForEntry(entry)
            const isFile = entry.type === 'file'
            const isJsonFile = isFile && entry.name.toLowerCase().endsWith('.json')
            const remoteMapping = metaPayload?.meta?.remote
            const remoteTarget = remoteMapping?.service && remoteMapping?.collection
                ? `${remoteMapping.service}/${remoteMapping.collection}${remoteMapping.id ? `/${remoteMapping.id}` : ''}`
                : ''
            const pinned = isJsonFile && isPinned?.(entry.path)
            const isNavFile = entry.type === 'file' && (entry.path || '').includes('system/navs')
            const navUrl = metaPayload?.meta?.url || ''
            const context = window['oaContext'] || {}
            const webHost = context.web || ''
            const sessionToken = context.session?.token || ''
            const webBase = webHost.replace(/\/+$/, '')
            const navPath = navUrl.replace(/^\/+/, '')
            const pageUrl = (isNavFile && navUrl && webHost)
                ? `${webBase.startsWith('http') ? webBase : `https://${webBase}`}/${navPath}?session-token=${sessionToken}`
                : ''

            const hasChanges = isFile && (Boolean(diffText.trim()) || entry.gitStatus !== 'clean')
            const isSpecFile = rootKind === 'specs' && isFile
            const specPath = normalizeSpecPath(entry.path)
            const specRunResult = specRunResults[specPath] || null
            const actionBar = isSpecFile ? '' : `
                            <div class="file-context-bar">
                                ${!isFile ? '<button type="button" class="copy-btn" data-add-file>Add File</button>' : ''}
                                ${!isFile ? `<button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.primary)}">${rootKind === 'specs' ? 'Test' : 'Pull'}</button>
                                <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.secondary)}">${rootKind === 'specs' ? 'Validate' : 'Push'}</button>` : rootKind === 'specs' ? `<button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.secondary)}">Validate</button>` : ''}
                                ${isFile && rootKind === 'content' && entry.name.toLowerCase().endsWith('.json') && remoteExists === true ? `<button type="button" class="copy-btn" data-sync-action="pull">Pull full remote file</button>` : ''}
                                ${isFile && rootKind === 'content' && entry.name.toLowerCase().endsWith('.json') && remoteExists === false ? `<button type="button" class="copy-btn" data-sync-action="push">Push full local file</button>` : ''}
                                ${isFile && !isSpecFile ? `<button type="button" class="copy-btn" data-run-command="${escapeHtml(`oa test${entry.cwdRelativePath ? ` --local ./${entry.cwdRelativePath}` : ''}`)}">Validate Schema</button>` : ''}
                                ${isFile && !isSpecFile ? `<button type="button" class="copy-btn" data-open-vscode="${escapeHtml(entry.path)}">Open In Editor</button>` : !isFile ? `<button type="button" class="copy-btn" data-open-path="${escapeHtml(entry.path)}">Open Folder</button>` : ''}
                                ${isJsonFile && !isSpecFile ? `<button type="button" class="copy-btn ${pinned ? 'is-pinned' : ''}" data-toggle-pin="${escapeHtml(entry.path)}">${pinned ? 'Unpin' : 'Pin'}</button>` : ''}
                                ${!isSpecFile ? `<button type="button" class="copy-btn" data-copy-webpath="${escapeHtml(entry.webPath || '')}">Copy Web URL</button>` : ''}
                                ${!isSpecFile && pageUrl ? `<a href="${escapeHtml(pageUrl)}" target="_blank" class="copy-btn">View Page</a>` : ''}
                            </div>
                        `
            const remotePanel = `
                            <section class="detail-section">
                                <h3>${isFile ? 'Remote' : 'Folder Metadata'}</h3>
                                ${remoteTarget ? `<p class="summary" data-folder-remote-mapping>Mapped resource: <code>${escapeHtml(remoteTarget)}</code></p>` : ''}
                                <form class="meta-form" data-meta-file-form>
                                    <select class="terminal-input" name="metaFile" aria-label="Remote metadata file">
                                        ${[...(metaPayload?.availableMetaFiles || []), metaPayload?.selectedMetaFile || 'meta.json']
                                            .filter((v, i, a) => v && a.indexOf(v) === i)
                                            .sort((a, b) => a.localeCompare(b))
                                            .map((name) => `<option value="${escapeHtml(name)}" ${name === metaPayload?.selectedMetaFile ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
                                    </select>
                                    <button class="copy-btn" type="submit">Load</button>
                                </form>
                                <form class="meta-form meta-form-stack" data-meta-json-form>
                                    <textarea class="meta-json" name="metaJson" spellcheck="false" aria-label="Remote metadata JSON">${escapeHtml(JSON.stringify(metaPayload?.meta || {}, null, 2))}</textarea>
                                    <button class="terminal-run" type="submit">Save</button>
                                </form>
                            </section>
                        `
            const schemaPanel = isFile ? `
                            <section class="detail-section">
                                <h3>Schema</h3>
                                <p class="summary">${metaPayload?.schemaEndpoint ? `Endpoint: <code>${escapeHtml(metaPayload.schemaEndpoint)}</code>` : 'No endpoint mapping available.'}</p>
                                <p class="summary">${metaPayload?.schemaFile ? `Schema: <code>${escapeHtml(metaPayload.schemaFile)}</code>` : ''}</p>
                                <div class="schema-language-slot" data-language-control-slot></div>
                                <pre class="terminal-output config-output schema-preview">${escapeHtml(JSON.stringify(metaPayload?.schema || {}, null, 2))}</pre>
                            </section>
                        ` : ''
            const changesPanel = hasChanges ? `
                            <section class="detail-section changes-section">
                                <h3>Uncommitted Changes</h3>
                                <form class="file-commit-form" data-commit-file-form>
                                    <input class="terminal-input" name="commitMessage" type="text" placeholder="Commit message" aria-label="Commit message" required />
                                    <button class="terminal-run" type="submit">Commit This File</button>
                                </form>
                                <pre class="terminal-output config-output git-diff-preview">${renderGitDiff(diffText || '(Untracked file; current contents will be committed.)')}</pre>
                            </section>
                        ` : ''
            const listingItems = activeRemoteListing?.ok
                ? activeRemoteListing.items || []
                : activeFolderContents.map((item) => ({ ...item, localExists: true, remoteExists: false }))
            const folderEntries = !isFile ? listingItems.map((item) => {
                const canOpen = Boolean(item.localExists && item.path)
                const statusRemote = item.type === 'directory'
                    ? '—'
                    : item.remoteExists
                        ? 'Yes'
                        : activeRemoteListing?.remoteAvailable
                            ? 'No'
                            : 'Unavailable'
                const content = `
                    <span class="folder-entry-kind" aria-hidden="true">${item.type === 'directory' ? 'DIR' : escapeHtml(getFileIcon(item.name))}</span>
                    <span class="folder-entry-name">${escapeHtml(item.name)}</span>
                    <span class="folder-entry-presence" aria-label="Local ${item.localExists ? 'exists' : 'missing'}">${item.localExists ? 'Yes' : 'No'}</span>
                    <span class="folder-entry-presence" aria-label="Remote ${statusRemote === '—' ? 'not applicable' : statusRemote.toLowerCase()}">${statusRemote}</span>
                `
                const attrs = canOpen
                    ? `type="button" data-select-path="${escapeHtml(item.path)}" data-entry-type="${escapeHtml(item.type)}" data-web-path="${escapeHtml(item.webPath || '')}" data-git-status="${escapeHtml(item.gitStatus || 'clean')}"`
                    : ''
                return `<${canOpen ? 'button' : 'div'} class="folder-entry-row${canOpen ? ' is-openable' : ' is-remote-only'}" ${attrs}>${content}</${canOpen ? 'button' : 'div'}>`
            }).join('') : ''
            const contextPanels = rootKind === 'specs'
                ? [{ key: 'last-run', label: 'Last run', content: `<section class="detail-section"><h3>Last run result</h3><div data-spec-last-run data-spec-path="${escapeHtml(specPath)}">${renderSpecRunResult(specRunResult)}</div></section>` }]
                : [
                    { key: 'remote', label: 'Remote', content: remotePanel },
                    ...(isFile ? [{ key: 'schema', label: 'Schema', content: schemaPanel }] : []),
                    ...(hasChanges ? [{ key: 'changes', label: 'Uncommitted Changes', content: changesPanel }] : [])
                ]
            const contextSidebar = `
                <aside class="file-detail-sidebar">
                    <div class="file-context-tabs" data-context-tabs>
                        <div class="file-context-tablist" role="tablist" aria-label="File context" data-context-tablist>
                            ${contextPanels.map((tab, index) => `<button type="button" class="file-context-tab${index === 0 ? ' is-active' : ''}" role="tab" id="file-context-tab-${tab.key}" aria-controls="file-context-panel-${tab.key}" aria-selected="${index === 0}" tabindex="${index === 0 ? '0' : '-1'}" data-context-tab="${tab.key}">${tab.label}</button>`).join('')}
                        </div>
                        ${contextPanels.map((tab, index) => `<div class="file-context-tabpanel" role="tabpanel" id="file-context-panel-${tab.key}" aria-labelledby="file-context-tab-${tab.key}" data-context-panel="${tab.key}"${index === 0 ? '' : ' hidden'}>${tab.content}</div>`).join('')}
                    </div>
                </aside>
            `

            return `
                            <section class="file-detail-view" id="details-card">
                                <header class="file-detail-title">
                                    <div class="file-detail-heading">
                                        <span class="file-icon"${rootKind === 'specs' && isFile ? ' aria-label="Test specification" title="Test specification"' : ''}>${rootKind === 'specs' && isFile ? '⚗' : isFile ? escapeHtml(getFileIcon(entry.name)) : 'DIR'}</span>
                                        <div><h2>${escapeHtml(entry.name || '')}</h2><p>${escapeHtml(entry.path || '')}</p></div>
                                    </div>
                                    ${isSpecFile ? `<div class="file-detail-header-actions spec-header-actions" role="toolbar" aria-label="Specification actions">
                                        <button type="button" class="copy-btn" data-spec-test="${escapeHtml(commands.primary)}" data-spec-path="${escapeHtml(specPath)}">Test</button>
                                        <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.secondary)}">Validate</button>
                                        <button type="button" class="copy-btn" data-open-vscode="${escapeHtml(entry.path)}">Open In Editor</button>
                                        <button type="submit" form="spec-file-content-form" class="copy-btn spec-save-button">Save</button>
                                        <button type="button" class="copy-btn ${pinned ? 'is-pinned' : ''}" data-toggle-pin="${escapeHtml(entry.path)}">${pinned ? 'Unpin' : 'Pin'}</button>
                                    </div>` : ''}
                                    ${isJsonFile && rootKind === 'content' ? `<div class="file-detail-header-actions" role="toolbar" aria-label="Comparison actions">
                                        <button type="button" class="copy-btn" data-viewer-action="sidebar" aria-pressed="true">Hide sidebar</button>
                                        <button type="button" class="copy-btn" data-viewer-action="focus" aria-pressed="false" title="Expand comparison; press Escape to exit">Focus mode</button>
                                        <button type="button" class="copy-btn" data-viewer-action="save">Save local</button>
                                    </div>` : ''}
                                    <button type="button" class="icon-button detail-back" data-details-back title="Back to parent folder" aria-label="Back to parent folder">&times;</button>
                                </header>
                                ${isFile ? `
                                    <div class="file-detail-columns">
                                        <main class="file-detail-main">
                                            ${actionBar}
                                            <p class="detail-feedback" data-meta-feedback aria-live="polite"></p>
                                            ${rootKind === 'content' && entry.name.toLowerCase().endsWith('.json') ? `<div class="diff-viewer-host" data-diff-host></div>${remoteError ? `<p class="diff-error" role="status">${escapeHtml(remoteError)}</p>` : remoteExists === false ? '<p class="diff-status" role="status">No remote resource exists for this mapping. Push the full local file to create it.</p>' : ''}` : `<form class="file-content-editor${isSpecFile ? ' spec-file-content-editor' : ''}" data-file-content-form${isSpecFile ? ' id="spec-file-content-form"' : ''}>${isSpecFile ? `<div class="spec-code-editor" data-spec-code-editor><div class="spec-code-gutter" data-code-gutter aria-hidden="true"></div><div class="spec-code-surface"><pre class="spec-code-highlight" data-code-highlight aria-hidden="true"></pre><textarea class="spec-code-input" name="fileContent" spellcheck="false" wrap="off" aria-label="Editable JSON specification">${escapeHtml(fileContent || '')}</textarea></div></div>` : `<textarea class="meta-json" name="fileContent" spellcheck="false" aria-label="File contents">${escapeHtml(fileContent || '')}</textarea><button class="terminal-run" type="submit">Save File</button>`}</form>`}
                                        </main>
                                        ${contextSidebar}
                                    </div>
                                ` : `
                                    <main class="folder-detail-main">
                                        <section class="folder-summary-card">
                                            <h3>Summary</h3>
                                            <p>${escapeHtml(entry.path || '')}</p>
                                            <span>${fileCount ?? 0} files · ${entries.filter((item) => item.type === 'directory').length} subfolders</span>
                                        </section>
                                        <p class="detail-feedback" data-meta-feedback aria-live="polite"></p>
                                        <div class="folder-detail-columns${rootKind === 'specs' ? ' specs-folder-columns' : ''}">
                                            <section class="folder-detail-column folder-local-column" aria-labelledby="folder-local-heading">
                                                <header><h3 id="folder-local-heading">Local</h3>${actionBar}</header>
                                                <div class="folder-entry-headings" aria-hidden="true"><span>Item</span><span>Local</span><span>Remote</span></div>
                                                <div class="folder-entry-list" aria-label="Local folder contents">
                                                    ${folderEntries || '<p class="summary">This folder is empty.</p>'}
                                                </div>
                                            </section>
                                            ${rootKind === 'content' ? `<section class="folder-detail-column folder-remote-column" aria-labelledby="folder-remote-heading">
                                                <h3 id="folder-remote-heading">Remote</h3>
                                                ${activeRemoteListing?.remoteAvailable ? `<p class="folder-remote-refresh" role="status">Refreshed ${escapeHtml(new Date(activeRemoteListing.fetchedAt).toLocaleTimeString())}</p>` : `<p class="folder-remote-refresh" role="status">${escapeHtml(activeRemoteListing?.error || 'Remote listing unavailable. Mapped file metadata is shown where available.')}</p>`}
                                                ${remotePanel}
                                            </section>` : ''}
                                        </div>
                                    </main>
                                `}
                            </section>
                        `
        }

        mainContent.innerHTML = await renderSectionTemplate(rootKind === 'specs' ? 'specs' : 'data', {
            FOLDER_WEB_PATH: escapeHtml(folderWebPath),
            BROWSE_PATH: escapeHtml(path || ''),
            DIRECTORY_ROWS: renderRows(metaSupport.selectedPath || '') || '<p class="summary">This folder is empty.</p>',
            DETAILS_CARD: renderDetails(folderSummary, rootMeta || {}, '', folderSummary.fileCount)
        })

        const directoryPane = mainContent.querySelector('#directory-list-pane')
        const detailsPane = mainContent.querySelector('#details-pane')
        const directorySplit = mainContent.querySelector('.directory-split')
        directorySplit?.classList.toggle('folder-selected', !metaSupport.selectedPath)

        const openInEditor = async (targetPath) => {
            const res = await fetch('/api/open-vscode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath })
            })
            if (!res.ok) {
                const msg = await res.json().catch(() => ({ stderr: 'Unable to open VS Code.' }))
                alert(msg.stderr || 'Unable to open VS Code.')
            }
        }

        let activeEntry = folderSummary
        let activeContextTab = 'remote'
        const bindDetailForms = (entry, metaPayload, state = {}) => {
            const feedbackEl = detailsPane.querySelector('[data-meta-feedback]')
            const metaFileForm = detailsPane.querySelector('[data-meta-file-form]')
            const metaJsonForm = detailsPane.querySelector('[data-meta-json-form]')
            const fileContentForm = detailsPane.querySelector('[data-file-content-form]')
            const specCodeEditor = detailsPane.querySelector('[data-spec-code-editor]')
            if (specCodeEditor) {
                const input = specCodeEditor.querySelector('.spec-code-input')
                const highlight = specCodeEditor.querySelector('[data-code-highlight]')
                const gutter = specCodeEditor.querySelector('[data-code-gutter]')
                const paint = () => {
                    const source = input.value
                    const tokens = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\],:]/g
                    let cursor = 0
                    let markup = ''
                    for (const match of source.matchAll(tokens)) {
                        const token = match[0]
                        const start = match.index
                        markup += escapeHtml(source.slice(cursor, start))
                        const type = token.startsWith('"') ? (/^\s*:/.test(source.slice(start + token.length)) ? 'property' : 'string')
                            : /^(true|false|null)$/.test(token) ? 'literal'
                                : /^[{}\[\],:]$/.test(token) ? 'punctuation' : 'number'
                        markup += `<span class="spec-token-${type}">${escapeHtml(token)}</span>`
                        cursor = start + token.length
                    }
                    markup += escapeHtml(source.slice(cursor))
                    highlight.innerHTML = `${markup}${source.endsWith('\n') ? ' ' : ''}`
                    gutter.textContent = Array.from({ length: source.split('\n').length }, (_, index) => String(index + 1)).join('\n')
                    highlight.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`
                    gutter.style.transform = `translateY(${-input.scrollTop}px)`
                }
                input.addEventListener('input', paint)
                input.addEventListener('scroll', paint)
                input.addEventListener('keydown', (event) => {
                    if (event.key !== 'Tab') return
                    event.preventDefault()
                    const start = input.selectionStart
                    const end = input.selectionEnd
                    input.setRangeText('  ', start, end, 'end')
                    input.dispatchEvent(new Event('input', { bubbles: true }))
                })
                paint()
            }
            detailsPane.querySelector('[data-spec-test]')?.addEventListener('click', async (event) => {
                const button = event.currentTarget
                const command = button.dataset.specTest || ''
                button.disabled = true
                try {
                    const result = await onRunSpecCommand?.(command, button.dataset.specPath || entry.path)
                    if (!result) throw new Error('Unable to run this specification test.')
                } catch (error) {
                    const result = { code: 1, stdout: '', stderr: error.message || 'Unable to run this specification test.' }
                    const specRunResult = { command, ...result, at: new Date().toISOString() }
                    const specPath = normalizeSpecPath(button.dataset.specPath || entry.path)
                    specRunResults[specPath] = specRunResult
                    try { localStorage.setItem('oa.spec.lastRuns', JSON.stringify(specRunResults)) } catch { /* session-only if storage is unavailable */ }
                    const resultPanel = mainContent.querySelector('[data-spec-last-run]')
                    if (resultPanel?.dataset.specPath === specPath) resultPanel.innerHTML = renderSpecRunResult(specRunResult)
                } finally {
                    button.disabled = false
                }
            })
            const commitFileForm = detailsPane.querySelector('[data-commit-file-form]')
            const contextTabList = detailsPane.querySelector('[data-context-tablist]')
            const contextTabButtons = [...(contextTabList?.querySelectorAll('[data-context-tab]') || [])]
            const contextTabPanels = [...(detailsPane.querySelectorAll('[data-context-panel]') || [])]
            const activateContextTab = (key, focus = false) => {
                const selected = contextTabButtons.find((button) => button.dataset.contextTab === key) || contextTabButtons[0]
                if (!selected) return
                activeContextTab = selected.dataset.contextTab
                contextTabButtons.forEach((button) => {
                    const active = button === selected
                    button.setAttribute('aria-selected', String(active))
                    button.tabIndex = active ? 0 : -1
                    button.classList.toggle('is-active', active)
                })
                contextTabPanels.forEach((panel) => {
                    panel.hidden = panel.dataset.contextPanel !== activeContextTab
                })
                if (focus) selected.focus()
            }
            activateContextTab(activeContextTab)
            contextTabList?.addEventListener('click', (event) => {
                const button = event.target.closest('[data-context-tab]')
                if (button) activateContextTab(button.dataset.contextTab)
            })
            contextTabList?.addEventListener('keydown', (event) => {
                const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
                if (!keys.includes(event.key) || !contextTabButtons.length) return
                event.preventDefault()
                const index = contextTabButtons.indexOf(event.target.closest('[data-context-tab]'))
                const nextIndex = event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                        ? contextTabButtons.length - 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + contextTabButtons.length) % contextTabButtons.length
                activateContextTab(contextTabButtons[nextIndex].dataset.contextTab, true)
            })
            const diffHost = detailsPane.querySelector('[data-diff-host]')
            let diffViewer = null
            if (diffHost && metaSupport.loadRemoteFile) {
                diffViewer = createDiffViewer({
                    host: diffHost,
                    path: entry.path,
                    localText: state.fileContent ?? '',
                    remoteText: state.remoteContent ?? '',
                    onSave: async (content) => {
                        const saved = await metaSupport.saveFileContent({ path: entry.path, content })
                        return saved?.ok ? saved : { ok: false, error: saved?.error || 'Unable to save local file.' }
                    }
                })
                const languageControl = diffHost.querySelector('.diff-language-label')
                const languageSlot = detailsPane.querySelector('[data-language-control-slot]')
                if (languageControl && languageSlot) languageSlot.appendChild(languageControl)
            }
            detailsPane.querySelectorAll('[data-viewer-action]').forEach((button) => button.addEventListener('click', () => {
                if (button.dataset.viewerAction === 'sidebar') diffViewer?.toggleSidebar()
                else if (button.dataset.viewerAction === 'focus') diffViewer?.toggleFocusMode()
                else if (button.dataset.viewerAction === 'save') diffViewer?.save()
            }))

            detailsPane.querySelectorAll('[data-sync-action]').forEach((button) => button.addEventListener('click', async () => {
                const action = button.dataset.syncAction
                const message = action === 'pull'
                    ? 'Pull the full remote file and replace the local file?'
                    : 'Push the full local file and replace the remote resource?'
                if (!window.confirm(message)) return
                button.disabled = true
                if (feedbackEl) feedbackEl.textContent = action === 'pull' ? 'Pulling remote file…' : 'Pushing full local file…'
                if (action === 'push' && diffViewer) {
                    const savedLocal = await metaSupport.saveFileContent({ path: entry.path, content: diffViewer.getLocal() })
                    if (!savedLocal?.ok) {
                        button.disabled = false
                        if (feedbackEl) feedbackEl.textContent = savedLocal?.error || 'Unable to save local file before pushing.'
                        return
                    }
                }
                const result = await metaSupport.runSyncAction?.({ action, path: entry.path, cwdRelativePath: entry.cwdRelativePath })
                if (!result?.ok) {
                    button.disabled = false
                    if (feedbackEl) feedbackEl.textContent = result?.stderr || result?.error || 'The remote action failed.'
                    return
                }
                diffViewer?.destroy()
                await selectEntry(entry)
                const refreshedFeedback = detailsPane.querySelector('[data-meta-feedback]')
                if (refreshedFeedback) refreshedFeedback.textContent = action === 'pull' ? 'Remote file pulled; merge base saved.' : 'Full local file pushed.'
            }))

            commitFileForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (!metaSupport.commitFile) return
                const formData = new FormData(commitFileForm)
                const message = String(formData.get('commitMessage') || '').trim()
                if (!message) return
                if (feedbackEl) feedbackEl.textContent = 'Committing this file...'
                const result = await metaSupport.commitFile({ path: entry.path, message })
                if (!result?.ok) {
                    if (feedbackEl) feedbackEl.textContent = result?.stderr || 'Unable to commit this file.'
                    return
                }
                if (metaSupport.refreshDirectory) {
                    await metaSupport.refreshDirectory(entry.path)
                }
            })

            metaFileForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (!metaSupport.loadMeta) return
                const formData = new FormData(metaFileForm)
                const selected = String(formData.get('metaFile') || '')
                const nextMeta = await metaSupport.loadMeta(entry.path, selected)
                const diffRes = entry.type === 'file' && metaSupport.loadGitDiff ? await metaSupport.loadGitDiff(entry.path) : { diff: '' }
                const currentFile = entry.type === 'file' && metaSupport.loadFileContent ? await metaSupport.loadFileContent(entry.path) : { ok: true, content: '' }
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                detailsPane.innerHTML = renderDetails(entry, nextMeta, diffRes.diff || '', fileCount, currentFile?.content || '', state.remoteContent || '', state.remoteError || '', state.remoteExists)
                bindDetailForms(entry, nextMeta, { ...state, fileContent: currentFile?.content || '' })
            })

            metaJsonForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (!metaSupport.saveMeta || !metaSupport.loadMeta) return
                const formData = new FormData(metaJsonForm)
                const rawJson = String(formData.get('metaJson') || '{}').trim()
                let parsedMeta
                try {
                    parsedMeta = rawJson ? JSON.parse(rawJson) : {}
                } catch {
                    if (feedbackEl) feedbackEl.textContent = 'Meta JSON is invalid.'
                    return
                }
                if (feedbackEl) feedbackEl.textContent = 'Saving meta...'
                const saved = await metaSupport.saveMeta({
                    path: entry.path,
                    metaFile: metaPayload?.selectedMetaFile || 'meta.json',
                    meta: parsedMeta
                })
                const nextMeta = saved?.ok ? saved : await metaSupport.loadMeta(entry.path, metaPayload?.selectedMetaFile || '')
                const diffRes = entry.type === 'file' && metaSupport.loadGitDiff ? await metaSupport.loadGitDiff(entry.path) : { diff: '' }
                const currentFile = entry.type === 'file' && metaSupport.loadFileContent ? await metaSupport.loadFileContent(entry.path) : { ok: true, content: '' }
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                detailsPane.innerHTML = renderDetails(entry, nextMeta, diffRes.diff || '', fileCount, currentFile?.content || '', state.remoteContent || '', state.remoteError || '', state.remoteExists)
                bindDetailForms(entry, nextMeta, { ...state, fileContent: currentFile?.content || '' })
            })

            fileContentForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (entry.type !== 'file' || !metaSupport.saveFileContent) return
                const formData = new FormData(fileContentForm)
                const nextContent = String(formData.get('fileContent') ?? '')
                if (feedbackEl) feedbackEl.textContent = 'Saving file...'
                const saved = await metaSupport.saveFileContent({ path: entry.path, content: nextContent })
                if (!saved?.ok) {
                    if (feedbackEl) feedbackEl.textContent = saved?.error || 'Unable to save file.'
                    return
                }
                const nextMeta = metaSupport.loadMeta ? await metaSupport.loadMeta(entry.path) : metaPayload
                const diffRes = entry.type === 'file' && metaSupport.loadGitDiff ? await metaSupport.loadGitDiff(entry.path) : { diff: '' }
                const currentFile = entry.type === 'file' && metaSupport.loadFileContent ? await metaSupport.loadFileContent(entry.path) : { ok: true, content: nextContent }
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                if (feedbackEl) feedbackEl.textContent = 'File saved.'
                detailsPane.innerHTML = renderDetails(entry, nextMeta || {}, diffRes.diff || '', fileCount, currentFile?.content || '', state.remoteContent || '', state.remoteError || '', state.remoteExists)
                bindDetailForms(entry, nextMeta || {}, { ...state, fileContent: currentFile?.content || '' })
            })
        }

        const selectEntry = async (entry) => {
            activeEntry = entry
            activeContextTab = 'remote'
                activeFolderContents = entry.type === 'directory' && entry.path !== path
                    ? ((await metaSupport.loadEntries?.(entry.path)) || [])
                    : entries
            metaSupport.onSelectPath?.(entry.type === 'file' || entry.path !== path ? entry.path : '')
            directorySplit?.classList.toggle('file-selected', entry.type === 'file')
            directorySplit?.classList.toggle('folder-selected', entry.type === 'directory')
            const selectedRows = mainContent.querySelectorAll('.dir-row.is-selected')
            selectedRows.forEach((node) => node.classList.remove('is-selected'))
            const selectedRow = mainContent.querySelector(`.dir-row[data-select-path="${CSS.escape(entry.path)}"]`)
            selectedRow?.classList.add('is-selected')

            const metaPayload = isMetaEnabled && metaSupport.loadMeta
                ? await metaSupport.loadMeta(entry.path)
                : (rootMeta || {})
            activeRemoteListing = entry.type === 'directory' && rootKind === 'content' && metaSupport.loadRemoteDirectory
                ? await metaSupport.loadRemoteDirectory(entry.path)
                : null
            const diffRes = entry.type === 'file' && metaSupport.loadGitDiff
                ? await metaSupport.loadGitDiff(entry.path)
                : { diff: '' }
            const fileContent = entry.type === 'file' && metaSupport.loadFileContent
                ? await metaSupport.loadFileContent(entry.path)
                : { ok: true, content: '' }
            const remoteResult = entry.type === 'file' && rootKind === 'content' && entry.name.toLowerCase().endsWith('.json') && metaSupport.loadRemoteFile
                ? await metaSupport.loadRemoteFile(entry.path)
                : null
            const comparisonState = {
                fileContent: fileContent?.content || '',
                remoteContent: remoteResult?.ok ? remoteResult.content : '',
                remoteError: remoteResult && !remoteResult.ok ? remoteResult.error || 'Remote comparison is unavailable.' : '',
                remoteExists: remoteResult?.ok ? remoteResult.exists !== false : null
            }
            const fileCount = entry.type === 'directory'
                ? activeFolderContents.filter((item) => item.type === 'file').length
                : null

            detailsPane.innerHTML = renderDetails(entry, metaPayload || {}, diffRes.diff || '', fileCount, fileContent?.content || '', comparisonState.remoteContent, comparisonState.remoteError, comparisonState.remoteExists)
            bindDetailForms(entry, metaPayload || {}, comparisonState)
        }

        mainContent.onclick = async (event) => {
            const addFile = event.target.closest('[data-add-file]')
            if (addFile) {
                if (!metaSupport.createFile) return
                const name = window.prompt('Enter a file name:', 'new-file.json')
                if (!name) return
                addFile.disabled = true
                const directory = activeEntry.type === 'directory' ? activeEntry.path : path
                try {
                    const created = await metaSupport.createFile({ directory, name: name.trim() })
                    if (!created?.ok) {
                        const feedback = detailsPane.querySelector('[data-meta-feedback]')
                        if (feedback) feedback.textContent = created?.error || 'Unable to create file.'
                        addFile.disabled = false
                        return
                    }
                    if (metaSupport.refreshDirectory) {
                        await metaSupport.refreshDirectory(created.path)
                    } else {
                        const feedback = detailsPane.querySelector('[data-meta-feedback]')
                        if (feedback) feedback.textContent = `${name.trim()} was created, but the folder could not be refreshed.`
                    }
                } catch (error) {
                    const feedback = detailsPane.querySelector('[data-meta-feedback]')
                    if (feedback) feedback.textContent = error?.message || 'The file could not be created. Please try again.'
                    addFile.disabled = false
                }
                return
            }

            const back = event.target.closest('[data-details-back]')
            if (back) {
                const pathToClose = activeEntry.path || ''
                const parentPath = pathToClose.includes('/') ? pathToClose.slice(0, pathToClose.lastIndexOf('/')) : ''
                await onOpenCrumb(parentPath)
                return
            }

            const fileLink = event.target.closest('.file-link')
            if (fileLink) event.preventDefault()

            const togglePin = event.target.closest('[data-toggle-pin]')
            if (togglePin) {
                if (!onTogglePin) return
                const pinned = await onTogglePin(togglePin.dataset.togglePin || '')
                togglePin.textContent = pinned ? 'Unpin' : 'Pin'
                togglePin.classList.toggle('is-pinned', pinned)
                return
            }

            const copyPath = event.target.closest('[data-copy-webpath]')
            if (copyPath) {
                await copyText(buildAbsoluteUrl(copyPath.dataset.copyWebpath), copyPath)
                return
            }

            const copyFolderPath = event.target.closest('[data-copy-folderwebpath]')
            if (copyFolderPath) {
                await copyText(buildAbsoluteUrl(copyFolderPath.dataset.copyFolderwebpath), copyFolderPath)
                return
            }

            const runCommandBtn = event.target.closest('[data-run-command]')
            if (runCommandBtn) {
                onUseCommand(runCommandBtn.dataset.runCommand || '')
                return
            }

            const openVsCode = event.target.closest('[data-open-vscode]')
            if (openVsCode) {
                await openInEditor(openVsCode.dataset.openVscode || '')
                return
            }

            const addLocal = event.target.closest('[data-add-local]')
            if (addLocal) {
                onAddLocalPath(addLocal.dataset.addLocal || '')
                return
            }

            const crumb = event.target.closest('[data-crumb-path]')
            if (crumb) {
                const next = crumb.dataset.crumbPath || ''
                onOpenCrumb(next)
                return
            }

            const openPath = event.target.closest('[data-open-path]')
            if (openPath) {
                const next = openPath.dataset.openPath
                onOpenFolder(next)
                onRefreshNav(next)
                return
            }

            const folderLink = event.target.closest('.folder-open-link')
            if (folderLink) {
                const next = folderLink.dataset.openPath
                onOpenFolder(next)
                onRefreshNav(next)
                return
            }

            const selectCard = event.target.closest('[data-select-path]')
            if (selectCard) {
                const selectPath = selectCard.dataset.selectPath || ''
                const entryType = selectCard.dataset.entryType || 'directory'
                const selectedEntry = {
                    type: entryType,
                    name: selectPath.split('/').filter(Boolean).at(-1) || '',
                    path: selectPath,
                    webPath: selectCard.dataset.webPath || '',
                    gitStatus: selectCard.dataset.gitStatus || 'clean',
                    cwdRelativePath: selectCard.dataset.cwdRelative || ''
                }
                await selectEntry(selectedEntry)
            }
        }

        bindDetailForms(folderSummary, rootMeta || {})
        const selectedEntry = metaSupport.selectedPath
            ? entries.find((entry) => {
                const entryPath = path ? `${path}/${entry.name}` : entry.name
                return entryPath === metaSupport.selectedPath
            })
            : null
        if (selectedEntry) {
            await selectEntry({ ...selectedEntry, path: metaSupport.selectedPath })
        }
    }

    const flattenConfig = (obj, prefix = '') => {
        if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
            return [{ key: prefix || '(root)', value: obj }]
        }

        const keys = Object.keys(obj)
        if (!keys.length && prefix) {
            return [{ key: prefix, value: {} }]
        }

        return keys.flatMap((key) => {
            const nextKey = prefix ? `${prefix}.${key}` : key
            const value = obj[key]
            if (value != null && typeof value === 'object' && !Array.isArray(value)) {
                return flattenConfig(value, nextKey)
            }
            return [{ key: nextKey, value }]
        })
    }

    const toConfigValueString = (value) => {
        if (value == null) return ''
        if (typeof value === 'string') return value
        if (typeof value === 'number' || typeof value === 'boolean') return String(value)
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }

    const renderConfig = async (configPayload, onRefresh, onSave) => {
        const flattened = flattenConfig(configPayload?.data || {})
            .sort((a, b) => a.key.localeCompare(b.key))

        const configDescriptions = {
            logger: 'Control logging verbosity and module-specific debug details. Values: fatal, error, warn, info, debug, trace, silly.',
            application: 'Core configuration for host, theme, and application-specific settings.',
            services: 'Service endpoint definitions and resource-specific remote configurations.',
            auth: 'Management of sessions, user identity, and authentication tokens.',
            ux: 'User experience settings including interactive mode and display mode (cli/web).',
            navs: 'Custom navigation overrides and UI layout configuration extensions.',
            git: 'Optional repository settings for git-integrated flows.'
        }

        const groups = flattened.reduce((acc, item) => {
            const root = item.key.split('.')[0] || '(root)'
            if (!acc[root]) acc[root] = []
            acc[root].push(item)
            return acc
        }, {})

        const metaMap = await loadSettingsMeta()

        const groupCards = Object.entries(groups).map(([root, items]) => {
            const description = configDescriptions[root.toLowerCase()] || ''
            const rows = items.map((item) => {
                const valueString = toConfigValueString(item.value)
                const meta = metaMap[item.key] || {}
                const type = meta.type || 'string'
                const displayName = meta.label || item.key

                let displayValue = valueString
                if (type === 'options' && meta.options) {
                    const choice = meta.options.find((c) => String(c.value) === String(item.value))
                    if (choice) {
                        displayValue = choice.name
                    }
                }

                let valDisplayHtml = `<code>${escapeHtml(displayValue)}</code>`
                if (type === 'boolean') {
                    const normalizedValue = String(item.value).toLowerCase()
                    const checked = (normalizedValue === 'true' || normalizedValue === '1' || item.value === true)
                    valDisplayHtml = `<input type="checkbox" class="config-checkbox" ${checked ? 'checked' : ''} disabled />`
                }

                return `
                  <div class="config-pair">
                    <div class="config-key" title="${escapeHtml(item.key)}">${escapeHtml(displayName)}:</div>
                    <div class="config-value" data-config-fill-key="${escapeHtml(item.key)}" data-config-fill-value="${escapeHtml(valueString)}">
                       ${valDisplayHtml}
                    </div>
                  </div>
                `
            }).join('')

            return `
              <section class="card config-group-card" id="config-section-${escapeHtml(root)}">
                <h3>${escapeHtml(root.toUpperCase())}</h3>
                ${description ? `<p class="summary">${escapeHtml(description)}</p>` : ''}
                <div class="config-list">
                  ${rows}
                </div>
              </section>
            `
        }).join('')

        const outputText = [configPayload?.output || '', configPayload?.error || '']
            .filter(Boolean)
            .join('\n')

        mainContent.innerHTML = await renderSectionTemplate('config', {
            CONFIG_OUTPUT: escapeHtml(outputText || '(No output)'),
            CONFIG_GROUPS: groupCards || '<section class="card"><p class="summary">No config values found.</p></section>'
        })

        const addBtn = mainContent.querySelector('#config-add-btn')
        addBtn?.addEventListener('click', async () => {
            const key = prompt('Enter configuration key (e.g., application.host):')
            if (!key) return
            const value = prompt(`Enter value for ${key}:`)
            if (value === null) return
            try {
                await onSave(key, value)
                const next = await onRefresh()
                await renderConfig(next, onRefresh, onSave)
            } catch (err) {
                alert(`Error saving config: ${err.message}`)
            }
        })

        mainContent.onclick = async (event) => {
            const fillBtn = event.target.closest('[data-config-fill-key]')
            if (fillBtn) {
                const key = fillBtn.dataset.configFillKey
                const pair = fillBtn.closest('.config-pair')
                if (!pair) return
                const valueContainer = pair.querySelector('.config-value')
                if (!valueContainer) return

                if (fillBtn.dataset.isEditing === 'true') {
                    // If already editing but blurred, re-focus
                    const input = valueContainer.querySelector('.inline-config-input, .config-checkbox')
                    if (input && input.style.display === 'none') {
                        valueContainer.dispatchEvent(new Event('focusin', { bubbles: true }))
                        input.focus()
                    }
                    return
                }

                const currentValue = fillBtn.dataset.configFillValue
                const isEncryptedInitial = currentValue === '******'

                const metaMap = await loadSettingsMeta()
                const meta = metaMap[key] || {}
                const type = meta.type || 'string'

                fillBtn.dataset.isEditing = 'true'
                fillBtn.classList.add('is-editing')

                let inputEl
                if (type === 'boolean') {
                    inputEl = document.createElement('input')
                    inputEl.className = 'config-checkbox'
                    inputEl.type = 'checkbox'
                    const normalizedValue = String(currentValue).toLowerCase()
                    inputEl.checked = (normalizedValue === 'true' || normalizedValue === '1')
                } else if (type === 'options' && meta.options) {
                    inputEl = document.createElement('select')
                    inputEl.className = 'terminal-input inline-config-input'
                    meta.options.forEach((choice) => {
                        const opt = document.createElement('option')
                        opt.value = choice.value
                        opt.textContent = choice.name
                        if (String(choice.value) === String(currentValue)) {
                            opt.selected = true
                        }
                        inputEl.appendChild(opt)
                    })
                } else {
                    inputEl = document.createElement('input')
                    inputEl.className = 'terminal-input inline-config-input'
                    inputEl.type = type === 'number' ? 'number' : 'text'
                    inputEl.value = isEncryptedInitial ? '' : currentValue
                    inputEl.placeholder = isEncryptedInitial ? '(Enter new secret)' : 'Value'
                }

                const encryptCheck = document.createElement('input')
                encryptCheck.type = 'checkbox'
                encryptCheck.className = 'config-checkbox'
                encryptCheck.checked = isEncryptedInitial

                const encryptLabel = document.createElement('label')
                encryptLabel.className = 'encrypt-label'
                encryptLabel.appendChild(encryptCheck)
                encryptLabel.appendChild(document.createTextNode('Encrypt'))

                const unsavedMark = document.createElement('span')
                unsavedMark.className = 'unsaved-mark'
                unsavedMark.textContent = '*'
                unsavedMark.style.display = 'none'

                const staticView = document.createElement('code')
                staticView.className = 'static-edit-view'
                staticView.style.display = 'none'

                const saveBtn = document.createElement('button')
                saveBtn.className = 'terminal-run inline-save'
                saveBtn.textContent = 'Save'

                const cancelBtn = document.createElement('button')
                cancelBtn.className = 'terminal-run inline-cancel'
                cancelBtn.textContent = 'Cancel'

                const actionArea = document.createElement('div')
                actionArea.className = 'inline-actions'
                actionArea.style.marginLeft = 'auto'
                actionArea.appendChild(saveBtn)
                actionArea.appendChild(cancelBtn)

                const editorWrapper = document.createElement('div')
                editorWrapper.className = 'inline-editor'
                editorWrapper.appendChild(inputEl)
                editorWrapper.appendChild(staticView)
                editorWrapper.appendChild(unsavedMark)
                editorWrapper.appendChild(encryptLabel)
                editorWrapper.appendChild(actionArea)

                const originalValueHtml = valueContainer.innerHTML
                valueContainer.innerHTML = ''
                valueContainer.appendChild(editorWrapper)

                const getInputValue = () => {
                    if (type === 'boolean') return String(inputEl.checked)
                    return inputEl.value
                }

                const checkChanges = () => {
                    const currentVal = getInputValue()
                    const hasChanged = String(currentVal) !== String(currentValue) || encryptCheck.checked !== isEncryptedInitial
                    unsavedMark.style.display = hasChanged ? 'inline-block' : 'none'
                    staticView.textContent = currentVal || (isEncryptedInitial ? '******' : '(empty)')
                }

                inputEl.addEventListener('input', checkChanges)
                inputEl.addEventListener('change', checkChanges)
                encryptCheck.addEventListener('change', checkChanges)

                let blurTimeout = null
                editorWrapper.addEventListener('focusin', () => {
                    if (blurTimeout) clearTimeout(blurTimeout)
                    inputEl.style.display = (type === 'boolean') ? 'inline-block' : 'inline-block'
                    encryptLabel.style.display = 'inline-flex'
                    actionArea.style.display = 'flex'
                    staticView.style.display = 'none'
                })

                editorWrapper.addEventListener('focusout', () => {
                    blurTimeout = setTimeout(() => {
                        if (!editorWrapper.contains(document.activeElement)) {
                            inputEl.style.display = 'none'
                            encryptLabel.style.display = 'none'
                            actionArea.style.display = 'none'
                            staticView.style.display = 'inline'
                            checkChanges()
                        }
                    }, 150)
                })

                inputEl.focus()

                const cleanup = () => {
                    fillBtn.dataset.isEditing = 'false'
                    fillBtn.classList.remove('is-editing')
                    valueContainer.innerHTML = originalValueHtml
                }

                cancelBtn.onclick = (e) => {
                    e.stopPropagation()
                    cleanup()
                }

                saveBtn.onclick = async (e) => {
                    e.stopPropagation()
                    const newValue = getInputValue()
                    const encryptValue = encryptCheck.checked
                    try {
                        await onSave(key, newValue, encryptValue)
                        const next = await onRefresh()
                        await renderConfig(next, onRefresh, onSave)
                    } catch (err) {
                        alert(`Error: ${err.message}`)
                        cleanup()
                    }
                }
            }

            const refreshBtn = event.target.closest('[data-config-refresh]')
            if (refreshBtn) {
                const next = await onRefresh()
                await renderConfig(next, onRefresh, onSave)
            }
        }

    }

    const renderHelp = async () => {
        mainContent.innerHTML = await renderSectionTemplate('help')
        mainContent.onclick = null
    }

    const renderChangelog = (markdown) => {
        const inline = (text) => escapeHtml(text)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        const blocks = []
        let paragraph = []
        let listItems = []

        const flushParagraph = () => {
            if (!paragraph.length) return
            blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
            paragraph = []
        }
        const flushList = () => {
            if (!listItems.length) return
            blocks.push(`<ul>${listItems.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`)
            listItems = []
        }

        String(markdown || '').split(/\r?\n/).forEach((line) => {
            const heading = line.match(/^(#{1,3})\s+(.+)$/)
            if (heading) {
                flushParagraph()
                flushList()
                const level = Math.min(4, heading[1].length + 1)
                blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`)
                return
            }
            if (/^[-*]\s+/.test(line)) {
                flushParagraph()
                listItems.push(line.replace(/^[-*]\s+/, ''))
                return
            }
            if (!line.trim()) {
                flushParagraph()
                flushList()
                return
            }
            paragraph.push(line.trim())
        })

        flushParagraph()
        flushList()
        mainContent.innerHTML = `<article class="changelog-view">${blocks.join('')}</article>`
        mainContent.onclick = null
    }

    const renderContext = async (contextData) => {
        mainContent.innerHTML = await renderSectionTemplate('context', {
            ENV: escapeHtml(contextData.env),
            TENANT: escapeHtml(contextData.tenant),
            ORGANIZATION: escapeHtml(contextData.organization),
            APPLICATION: escapeHtml(contextData.application),
            USER_NAME: escapeHtml(contextData.user),
            USER_ROLE: escapeHtml(contextData.role),
            SESSION_TOKEN: escapeHtml(contextData.session?.token ? `${contextData.session.token.slice(0, 10)}...` : 'N/A'),
            SESSION_EXPIRES: escapeHtml(contextData.session?.expiresAt || 'N/A'),
            SESSION_REMAINING: escapeHtml(contextData.session?.remainingMs != null ? `${Math.floor(contextData.session.remainingMs / 1000)}s` : 'N/A')
        })

        const groups = mainContent.querySelectorAll('.config-group-card')
        groups.forEach((group) => {
            const h3 = group.querySelector('h3')
            const footer = document.createElement('section')
            footer.className = 'details-footer'
            footer.style.marginTop = '1rem'
            footer.style.borderTop = '1px solid var(--border-color)'
            footer.style.paddingTop = '1rem'

            const actionDiv = document.createElement('div')
            actionDiv.className = 'example-actions'

            const addCopyUrl = (label, segment) => {
                const btn = document.createElement('button')
                btn.type = 'button'
                btn.className = 'copy-btn'
                btn.textContent = `Copy ${label} JSON URL`
                btn.onclick = async () => {
                    const url = `${window.location.origin}/$context/${segment}`
                    await copyText(url, btn)
                }
                actionDiv.appendChild(btn)
            }

            if (h3.textContent === 'SESSION') {
                addCopyUrl('Session', 'session')
            } else if (h3.textContent === 'WORKSPACE') {
                addCopyUrl('Env', 'env')
                addCopyUrl('Tenant', 'tenant')
                addCopyUrl('Org', 'organization')
                addCopyUrl('App', 'application')
            } else if (h3.textContent === 'USER') {
                addCopyUrl('User', 'user')
                addCopyUrl('Role', 'role')
            }

            footer.appendChild(actionDiv)
            group.appendChild(footer)
        })

        mainContent.onclick = null
    }

    return {
        renderHome,
        renderDirectoryContent,
        recordSpecRunResult: (command, result, selectedSpecPath = '') => {
            if (!/^\s*oa\s+test\b/i.test(String(command || ''))) return
            const specPath = normalizeSpecPath(selectedSpecPath || specPathFromCommand(command))
            if (!specPath) return
            const specRunResult = { command: String(command), ...result, at: new Date().toISOString() }
            specRunResults[specPath] = specRunResult
            try { localStorage.setItem('oa.spec.lastRuns', JSON.stringify(specRunResults)) } catch { /* session-only if storage is unavailable */ }
            const resultPanel = mainContent.querySelector('[data-spec-last-run]')
            if (resultPanel?.dataset.specPath === specPath) resultPanel.innerHTML = renderSpecRunResult(specRunResult)
        },
        renderConfig,
        renderHelp,
        renderChangelog,
        renderContext
    }
}
