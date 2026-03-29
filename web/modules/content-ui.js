import { renderExamples } from './templates.js'
import { copyText, buildAbsoluteUrl, getFileIcon, escapeHtml } from './utils.js'

export const createContentUi = ({ mainContent, cardCommands, commandIcons, onUseCommand, onAddLocalPath }) => {
    const sectionTemplateCache = new Map()

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
            const schemaOptions = [...(metaPayload?.schemaOptions || []), ...(metaPayload?.schemaType ? [{ value: metaPayload.schemaType, label: metaPayload.schemaType }] : [])]
                .filter((item, index, arr) => item?.value && arr.findIndex((other) => other?.value === item.value) === index)
            return `
              <section class="card meta-card" id="details-card">
                <section class="details-header">
                  <span class="file-icon">${isFile ? escapeHtml(getFileIcon(entry.name)) : 'DIR'}</span>
                  <strong>${escapeHtml(entry.name || '')}</strong>
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

                <section class="details-footer">
                  <div class="example-actions">
                    <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.primary)}">${rootKind === 'specs' ? 'Test' : 'Pull'}</button>
                    <button type="button" class="copy-btn" data-run-command="${escapeHtml(commands.secondary)}">${rootKind === 'specs' ? 'Validate' : 'Push'}</button>
                    ${isFile ? `<button type="button" class="copy-btn" data-run-command="${escapeHtml(`oa test${entry.cwdRelativePath ? ` --local ./${entry.cwdRelativePath}` : ''}`)}">Validate Schema</button>` : ''}
                    ${isFile ? `<button type="button" class="copy-btn" data-open-vscode="${escapeHtml(entry.path)}">Open In Editor</button>` : `<button type="button" class="copy-btn" data-open-path="${escapeHtml(entry.path)}">Open Folder</button>`}
                    <button type="button" class="copy-btn" data-copy-webpath="${escapeHtml(entry.webPath || '')}">Copy Web URL</button>
                  </div>
                  <p class="summary" data-meta-feedback></p>
                </section>
              </section>
            `
        }

        mainContent.innerHTML = await renderSectionTemplate(rootKind === 'specs' ? 'specs' : 'data', {
            FOLDER_WEB_PATH: escapeHtml(folderWebPath),
            BROWSE_PATH: escapeHtml(path || ''),
            DIRECTORY_ROWS: renderRows('') || '<p class="summary">This folder is empty.</p>',
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
        const rows = flattenConfig(configPayload?.data || {})
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((item) => {
                const valueString = toConfigValueString(item.value)
                return `
                  <tr>
                    <td><code>${escapeHtml(item.key)}</code></td>
                    <td><code>${escapeHtml(valueString)}</code></td>
                    <td><button type="button" class="copy-btn" data-config-fill-key="${escapeHtml(item.key)}" data-config-fill-value="${escapeHtml(valueString)}">Edit</button></td>
                  </tr>
                `
            }).join('')

        const outputText = [configPayload?.output || '', configPayload?.error || '']
            .filter(Boolean)
            .join('\n')

        mainContent.innerHTML = await renderSectionTemplate('config', {
            CONFIG_OUTPUT: escapeHtml(outputText || '(No output)'),
            CONFIG_ROWS: rows || '<tr><td colspan="3">No config values found.</td></tr>'
        })

        const configForm = mainContent.querySelector('#config-form')
        const keyInput = mainContent.querySelector('#config-key-input')
        const valueInput = mainContent.querySelector('#config-value-input')
        const encryptInput = mainContent.querySelector('#config-encrypt-input')
        const feedback = mainContent.querySelector('#config-feedback')

        mainContent.onclick = async (event) => {
            const refreshBtn = event.target.closest('[data-config-refresh]')
            if (refreshBtn) {
                const next = await onRefresh()
                await renderConfig(next, onRefresh, onSave)
                return
            }

            const useBtn = event.target.closest('[data-use-command]')
            if (useBtn) {
                onUseCommand(useBtn.dataset.useCommand || 'oa config')
                return
            }

            const fillBtn = event.target.closest('[data-config-fill-key]')
            if (fillBtn && keyInput && valueInput && encryptInput) {
                keyInput.value = fillBtn.dataset.configFillKey || ''
                valueInput.value = fillBtn.dataset.configFillValue || ''
                encryptInput.checked = valueInput.value === '******'
                keyInput.focus()
            }
        }

        configForm?.addEventListener('submit', async (event) => {
            event.preventDefault()
            const key = String(keyInput?.value || '').trim()
            const value = String(valueInput?.value || '')
            const encrypt = Boolean(encryptInput?.checked)

            if (!key) {
                if (feedback) feedback.textContent = 'Key is required.'
                return
            }

            if (feedback) feedback.textContent = 'Saving...'
            const next = await onSave({ key, value, encrypt })
            if (!next?.ok) {
                if (feedback) feedback.textContent = next?.error || 'Unable to save config.'
                return
            }

            await renderConfig(next, onRefresh, onSave)
            const nextFeedback = mainContent.querySelector('#config-feedback')
            if (nextFeedback) {
                nextFeedback.textContent = `Saved ${key}.`
            }
        })
    }

    return {
        renderHome,
        renderDirectoryContent,
        renderConfig
    }
}
