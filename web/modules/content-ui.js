import { renderExamples } from './templates.js'
import { copyText, buildAbsoluteUrl, getFileIcon, escapeHtml } from './utils.js'

export const createContentUi = ({ mainContent, cardCommands, commandIcons, onUseCommand, onAddLocalPath, isPinned, onTogglePin }) => {
    const sectionTemplateCache = new Map()
    let settingsMeta = null

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

    const renderHome = async () => {
        mainContent.innerHTML = await renderSectionTemplate('overview', {
            COMMAND_CARDS: buildCommandCards()
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

        const renderDetails = (entry, metaPayload, diffText = '', fileCount = null) => {
            const commands = getCommandsForEntry(entry)
            const isFile = entry.type === 'file'
            const isJsonFile = isFile && entry.name.toLowerCase().endsWith('.json')
            const pinned = isJsonFile && isPinned?.(entry.path)
            const schemaOptions = [...(metaPayload?.schemaOptions || []), ...(metaPayload?.schemaType ? [{ value: metaPayload.schemaType, label: metaPayload.schemaType }] : [])]
                .filter((item, index, arr) => item?.value && arr.findIndex((other) => other?.value === item.value) === index)
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

            return `
              <section class="card meta-card" id="details-card">
                <section class="details-header">
                  <span class="file-icon">${isFile ? escapeHtml(getFileIcon(entry.name)) : 'DIR'}</span>
                  <strong>${escapeHtml(entry.name || '')}</strong>
                </section>

                                <section class="details-actions">
                                    <div class="example-actions">
                                        <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.primary)}">${rootKind === 'specs' ? 'Test' : 'Pull'}</button>
                                        <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.secondary)}">${rootKind === 'specs' ? 'Validate' : 'Push'}</button>
                                        ${isFile ? `<button type="button" class="copy-btn" data-run-command="${escapeHtml(`oa test${entry.cwdRelativePath ? ` --local ./${entry.cwdRelativePath}` : ''}`)}">Validate Schema</button>` : ''}
                                        ${isFile ? `<button type="button" class="copy-btn" data-open-vscode="${escapeHtml(entry.path)}">Open In Editor</button>` : `<button type="button" class="copy-btn" data-open-path="${escapeHtml(entry.path)}">Open Folder</button>`}
                                        ${isJsonFile ? `<button type="button" class="copy-btn ${pinned ? 'is-pinned' : ''}" data-toggle-pin="${escapeHtml(entry.path)}">${pinned ? 'Unpin' : 'Pin'}</button>` : ''}
                                        <button type="button" class="copy-btn" data-copy-webpath="${escapeHtml(entry.webPath || '')}">Copy Web URL</button>
                                        ${pageUrl ? `<a href="${escapeHtml(pageUrl)}" target="_blank" class="copy-btn">View Page</a>` : ''}
                                    </div>
                                    <p class="summary" data-meta-feedback></p>
                                </section>

                <section class="details-body">
                  <form class="meta-form" data-meta-schema-form>
                    <select class="terminal-input" name="schemaType">
                      <option value="">(none)</option>
                      ${schemaOptions.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === metaPayload?.schemaType ? 'selected' : ''}>${escapeHtml(item.label || item.value)}</option>`).join('')}
                    </select>
                    <button class="terminal-run" type="submit">Save Schema Type</button>
                  </form>
                  <form class="meta-form" data-meta-file-form>
                    <label class="summary">Meta File</label>
                    <select class="terminal-input" name="metaFile">
                      ${[...(metaPayload?.availableMetaFiles || []), metaPayload?.selectedMetaFile || 'meta.json']
                    .filter((v, i, a) => v && a.indexOf(v) === i)
                    .sort((a, b) => a.localeCompare(b))
                    .map((name) => `<option value="${escapeHtml(name)}" ${name === metaPayload?.selectedMetaFile ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
                    </select>
                    <button class="copy-btn" type="submit">Load</button>
                  </form>
                  <form class="meta-form meta-form-stack" data-meta-json-form>
                    <textarea class="meta-json" name="metaJson" spellcheck="false">${escapeHtml(JSON.stringify(metaPayload?.meta || {}, null, 2))}</textarea>
                    <button class="terminal-run" type="submit">Save Meta JSON</button>
                  </form>
                  <details>
                    <summary>Schema</summary>
                    <pre class="terminal-output config-output">${escapeHtml(JSON.stringify(metaPayload?.schema || {}, null, 2))}</pre>
                  </details>
                  ${isFile ? `
                    <details open>
                      <summary>Git Diff</summary>
                      <pre class="terminal-output config-output">${escapeHtml(diffText || '(No diff)')}</pre>
                    </details>
                  ` : `<p class="summary">No. of files: ${fileCount ?? 0}</p>`}
                </section>

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

        const bindDetailForms = (entry, metaPayload) => {
            const feedbackEl = detailsPane.querySelector('[data-meta-feedback]')
            const metaFileForm = detailsPane.querySelector('[data-meta-file-form]')
            const schemaForm = detailsPane.querySelector('[data-meta-schema-form]')
            const metaJsonForm = detailsPane.querySelector('[data-meta-json-form]')

            metaFileForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (!metaSupport.loadMeta) return
                const formData = new FormData(metaFileForm)
                const selected = String(formData.get('metaFile') || '')
                const nextMeta = await metaSupport.loadMeta(entry.path, selected)
                const diffRes = entry.type === 'file' && metaSupport.loadGitDiff ? await metaSupport.loadGitDiff(entry.path) : { diff: '' }
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                detailsPane.innerHTML = renderDetails(entry, nextMeta, diffRes.diff || '', fileCount)
                bindDetailForms(entry, nextMeta)
            })

            schemaForm?.addEventListener('submit', async (event) => {
                event.preventDefault()
                if (!metaSupport.saveMeta || !metaSupport.loadMeta) return
                const formData = new FormData(schemaForm)
                const schemaType = String(formData.get('schemaType') || '')
                if (feedbackEl) feedbackEl.textContent = 'Saving schema type...'
                const saved = await metaSupport.saveMeta({
                    path: entry.path,
                    metaFile: metaPayload?.selectedMetaFile || 'meta.json',
                    schemaType
                })
                const nextMeta = saved?.ok ? saved : await metaSupport.loadMeta(entry.path, metaPayload?.selectedMetaFile || '')
                const diffRes = entry.type === 'file' && metaSupport.loadGitDiff ? await metaSupport.loadGitDiff(entry.path) : { diff: '' }
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                detailsPane.innerHTML = renderDetails(entry, nextMeta, diffRes.diff || '', fileCount)
                bindDetailForms(entry, nextMeta)
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
                const fileCount = entry.type === 'directory'
                    ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                    : null
                detailsPane.innerHTML = renderDetails(entry, nextMeta, diffRes.diff || '', fileCount)
                bindDetailForms(entry, nextMeta)
            })
        }

        const selectEntry = async (entry) => {
            const selectedRows = mainContent.querySelectorAll('.dir-row.is-selected')
            selectedRows.forEach((node) => node.classList.remove('is-selected'))
            const selectedRow = mainContent.querySelector(`.dir-row[data-select-path="${CSS.escape(entry.path)}"]`)
            selectedRow?.classList.add('is-selected')

            const metaPayload = isMetaEnabled && metaSupport.loadMeta
                ? await metaSupport.loadMeta(entry.path)
                : (rootMeta || {})
            const diffRes = entry.type === 'file' && metaSupport.loadGitDiff
                ? await metaSupport.loadGitDiff(entry.path)
                : { diff: '' }
            const fileCount = entry.type === 'directory'
                ? (entry.path === path ? folderSummary.fileCount : ((await metaSupport.loadEntries?.(entry.path)) || []).filter((item) => item.type === 'file').length)
                : null

            detailsPane.innerHTML = renderDetails(entry, metaPayload || {}, diffRes.diff || '', fileCount)
            bindDetailForms(entry, metaPayload || {})
        }

        mainContent.onclick = async (event) => {
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
              <section class="card config-group-card">
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
        renderConfig,
        renderHelp,
        renderContext
    }
}
