import { calculateDiffRows, getChangedHunks, inlineRange } from './diff-engine.js'

const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const highlightJson = (source) => html(source).replace(/(&quot;.*?&quot;)(\s*:)?|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, (token, quoted, colon) => {
    if (quoted) return `<span class="syntax-key${colon ? ' syntax-property' : ''}">${token}</span>`
    if (token === 'true' || token === 'false' || token === 'null') return `<span class="syntax-literal">${token}</span>`
    return `<span class="syntax-number">${token}</span>`
})

const highlightSource = (source, language) => language === 'json' ? highlightJson(source) : html(source)

export const createDiffViewer = ({ host, path, localText, remoteText, onSave, onFeedback }) => {
    let local = String(localText ?? '')
    let remote = String(remoteText ?? '')
    let rows = []
    let hunks = []
    let viewMode = window.matchMedia('(max-width: 900px)').matches ? 'unified' : 'side'
    let differencesOnly = false
    let ignoreWhitespace = true
    let activeHunk = 0
    let selectedHunk = -1
    let renderTimer = null
    let worker = null
    let requestId = 0
    const extension = path.split('.').at(-1)?.toLowerCase() || ''

    try {
        worker = new Worker(new URL('./diff-worker.js', import.meta.url), { type: 'module' })
        worker.onmessage = (event) => {
            if (event.data?.id !== requestId) return
            rows = event.data.rows || []
            afterDiff()
        }
    } catch {
        worker = null
    }

    host.innerHTML = `
        <section class="diff-viewer" aria-label="File comparison">
          <div class="diff-toolbar" role="toolbar" aria-label="Comparison controls">
            <button type="button" data-diff-action="previous" aria-label="Previous difference" title="Previous difference (Alt+↑)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 10 5-5 5 5"/></svg></button>
            <span class="diff-count" data-diff-count aria-live="polite"></span>
            <button type="button" data-diff-action="next" aria-label="Next difference" title="Next difference (Alt+↓)"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg></button>
            <button type="button" data-diff-action="toggle-only" aria-label="Differences only" title="Show differences only" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h10M3 8h4m3 0h3M3 13h10M8 6v4"/></svg></button>
            <button type="button" data-diff-action="toggle-whitespace" aria-label="Ignore whitespace" title="Whitespace-only differences are ignored" aria-pressed="true"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h8M2 12h5"/><circle cx="12" cy="8" r=".7"/></svg></button>
            <button type="button" data-diff-action="toggle-view" aria-label="Switch to unified view" title="Switch to unified view"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12v10H2zM8 3v10M4 6h2m4 0h2M4 10h2m4 0h2"/></svg></button>
          </div>
          <div class="diff-legend"><span class="diff-added-key">Remote change</span><span class="diff-removed-key">Local change</span><span data-diff-status aria-live="polite"></span></div>
          <div class="diff-columns ${viewMode === 'unified' ? 'is-unified' : ''}" data-diff-columns>
            <div class="diff-pane"><header>Local <span data-local-count></span></header><div class="diff-scroll" data-side="local" tabindex="0" aria-label="Editable local file comparison pane"></div></div>
            <div class="diff-pane diff-remote-pane"><header>Remote <span data-remote-count></span></header><div class="diff-scroll" data-side="remote" tabindex="0" aria-label="Read-only remote file comparison pane"></div></div>
          </div>
          <nav class="diff-minimap" aria-label="Difference overview" data-diff-minimap></nav>
          <footer class="diff-footer"><label class="diff-language-label">Language
            <select data-diff-language aria-label="Syntax highlighting language">
              <option value="auto">Auto</option><option value="json">JSON</option><option value="text">Plain text</option>
            </select>
          </label></footer>
        </section>`

    const toolbar = host.querySelector('.diff-toolbar')
    const columns = host.querySelector('[data-diff-columns]')
    const localPane = host.querySelector('[data-side="local"]')
    const remotePane = host.querySelector('[data-side="remote"]')
    const status = host.querySelector('[data-diff-status]')
    const detailView = host.closest('.file-detail-view')
    const actionsRoot = host.closest('#main-content') || detailView
    const sidebarButton = actionsRoot?.querySelector('[data-viewer-action="sidebar"]')

    const setSidebarVisible = (visible) => {
        detailView?.classList.toggle('is-sidebar-hidden', !visible)
        if (!sidebarButton) return
        sidebarButton.setAttribute('aria-pressed', String(visible))
        sidebarButton.setAttribute('aria-label', visible ? 'Hide sidebar' : 'Show sidebar')
        sidebarButton.title = visible ? 'Hide sidebar' : 'Show sidebar'
        sidebarButton.dataset.tooltip = sidebarButton.title
    }

    const compute = () => {
        requestId++
        if (worker) worker.postMessage({ id: requestId, left: local, right: remote, ignoreWhitespace })
        else {
            rows = calculateDiffRows(local, remote, 32, ignoreWhitespace)
            afterDiff()
        }
    }

    const afterDiff = () => {
        hunks = getChangedHunks(rows)
        activeHunk = Math.min(activeHunk, Math.max(0, hunks.length - 1))
        render()
    }

    const rowHtml = (row, index, side) => {
        const number = side === 'local' ? row.leftLine : row.rightLine
        const text = number == null ? '' : (side === 'local' ? local : remote).split('\n')[number] ?? ''
        const both = row.leftLine != null && row.rightLine != null
        const range = both && row.changed ? inlineRange(local.split('\n')[row.leftLine] || '', remote.split('\n')[row.rightLine] || '', ignoreWhitespace) : null
        const localSide = side === 'local'
        const language = host.dataset.language || extension
        let content = highlightSource(text, language)
        if (range && (localSide ? range.leftEnd > range.start : range.rightEnd > range.start)) {
            const end = localSide ? range.leftEnd : range.rightEnd
            content = `${highlightSource(text.slice(0, range.start), language)}<mark class="diff-inline">${highlightSource(text.slice(range.start, end), language)}</mark>${highlightSource(text.slice(end), language)}`
        }
        const hunkIndex = row.changed ? hunks.findIndex((hunk) => index >= hunk.start && index <= hunk.end) : -1
        const selected = hunkIndex >= 0 && hunkIndex === selectedHunk
        const classes = [row.changed ? (localSide ? 'is-removed' : 'is-added') : '', selected ? 'is-selected-hunk' : ''].filter(Boolean).join(' ')
        if (number == null) return `<div class="diff-row diff-empty ${classes}" data-row="${index}"><span class="diff-line-number">·</span><span class="diff-code" aria-hidden="true">&nbsp;</span>${row.changed && localSide ? `<button type="button" class="apply-remote-line" data-apply-row="${index}" aria-label="Apply remote line to local">←</button>` : ''}</div>`
        const editable = localSide ? ' contenteditable="true" role="textbox" aria-label="Local line ' + (number + 1) + '" spellcheck="false"' : ''
        const hunk = hunkIndex >= 0 ? hunks[hunkIndex] : null
        return `<div class="diff-row ${classes}" data-row="${index}" data-line="${number}"><span class="diff-line-number">${number + 1}</span><span class="diff-code"${editable}>${content || '&nbsp;'}</span>${row.changed && localSide ? `<button type="button" class="apply-remote-line" data-apply-row="${index}" aria-label="Apply remote line to local">←</button>${hunk?.start === index ? `<button type="button" class="apply-remote-line" data-apply-hunk="${hunkIndex}" aria-label="Apply remote hunk to local">≪</button>` : ''}` : ''}</div>`
    }

    const render = () => {
        const sourceRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => !differencesOnly || row.changed)
        const visible = viewMode === 'unified'
            ? sourceRows.flatMap(({ row, index }) => row.changed && row.leftLine != null && row.rightLine != null
                ? [{ row, index, side: 'local' }, { row, index, side: 'remote' }]
                : [{ row, index, side: row.leftLine == null ? 'remote' : 'local' }])
            : sourceRows.map((item) => ({ ...item, side: null }))
        const viewport = 140
        const rowHeight = 28
        const paint = (pane, side) => {
            const scrollTop = pane.scrollTop
            const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 8)
            const end = Math.min(visible.length, start + viewport)
            const spacerTop = start * rowHeight
            const spacerBottom = Math.max(0, (visible.length - end) * rowHeight)
            pane.innerHTML = `<div style="height:${spacerTop}px" aria-hidden="true"></div>${visible.slice(start, end).map(({ row, index, side: rowSide }) => rowHtml(row, index, rowSide || side)).join('')}<div style="height:${spacerBottom}px" aria-hidden="true"></div>`
            pane.scrollTop = scrollTop
        }
        paint(localPane, 'local')
        paint(remotePane, 'remote')
        toolbar.querySelector('[data-diff-count]').textContent = `${hunks.length ? activeHunk + 1 : 0} / ${hunks.length} changes`
        host.querySelector('[data-local-count]').textContent = `(${local.split('\n').length} lines)`
        host.querySelector('[data-remote-count]').textContent = `(${remote.split('\n').length} lines)`
        host.querySelector('[data-diff-minimap]').innerHTML = hunks.map((hunk, index) => `<button type="button" style="left:${rows.length ? (hunk.start / rows.length) * 100 : 0}%" data-minimap-hunk="${index}" aria-label="Go to difference ${index + 1}" title="Difference ${index + 1}"></button>`).join('') || '<span>No differences</span>'
        toolbar.querySelector('[data-diff-action="toggle-only"]').setAttribute('aria-pressed', String(differencesOnly))
        const whitespaceButton = toolbar.querySelector('[data-diff-action="toggle-whitespace"]')
        whitespaceButton.setAttribute('aria-pressed', String(ignoreWhitespace))
        whitespaceButton.title = ignoreWhitespace ? 'Whitespace-only differences are ignored' : 'Whitespace differences are shown'
        const viewButton = toolbar.querySelector('[data-diff-action="toggle-view"]')
        viewButton.setAttribute('aria-label', viewMode === 'side' ? 'Switch to unified view' : 'Switch to side-by-side view')
        viewButton.title = viewMode === 'side' ? 'Switch to unified view' : 'Switch to side-by-side view'
        viewButton.disabled = viewMode === 'unified' && window.matchMedia('(max-width: 900px)').matches
        columns.classList.toggle('is-unified', viewMode === 'unified')
    }

    const scrollToHunk = (index) => {
        if (!hunks.length) return
        activeHunk = (index + hunks.length) % hunks.length
        const target = hunks[activeHunk].start
        const top = target * 28
        localPane.scrollTop = top
        remotePane.scrollTop = top
        render()
    }

    const applyHunk = (index) => {
        const hunk = hunks[index]
        if (!hunk) return
        const segment = rows.slice(hunk.start, hunk.end + 1)
        const first = segment.findIndex((row) => row.leftLine != null)
        const last = segment.length - 1 - [...segment].reverse().findIndex((row) => row.leftLine != null)
        const insertAt = first < 0 ? (segment[0]?.leftLine ?? rows.slice(0, hunk.start).filter((row) => row.leftLine != null).length) : segment[first].leftLine
        const removeCount = first < 0 ? 0 : segment.slice(first, last + 1).filter((row) => row.leftLine != null).length
        const replacement = segment.filter((row) => row.rightLine != null).map((row) => remote.split('\n')[row.rightLine])
        const lines = local.split('\n')
        lines.splice(insertAt, removeCount, ...replacement)
        local = lines.join('\n')
        selectedHunk = -1
        compute()
        status.textContent = 'Remote change applied locally. Save to write the file.'
    }

    const applyLine = (index) => {
        const row = rows[index]
        if (!row?.changed) return
        const lines = local.split('\n')
        const insertAt = row.leftLine == null
            ? rows.slice(0, index).filter((item) => item.leftLine != null).length
            : row.leftLine
        const replacement = row.rightLine == null ? [] : [remote.split('\n')[row.rightLine]]
        lines.splice(insertAt, row.leftLine == null ? 0 : 1, ...replacement)
        local = lines.join('\n')
        compute()
        status.textContent = 'Remote line applied locally. Save to write the file.'
    }

    toolbar.addEventListener('click', (event) => {
        const action = event.target.closest('[data-diff-action]')?.dataset.diffAction
        if (action === 'previous') scrollToHunk(activeHunk - 1)
        else if (action === 'next') scrollToHunk(activeHunk + 1)
        else if (action === 'toggle-only') { differencesOnly = !differencesOnly; render() }
        else if (action === 'toggle-whitespace') { ignoreWhitespace = !ignoreWhitespace; compute() }
        else if (action === 'toggle-view') {
            if (viewMode === 'side') viewMode = 'unified'
            else if (!window.matchMedia('(max-width: 900px)').matches) viewMode = 'side'
            render()
        }
        const apply = event.target.closest('[data-apply-hunk]')
        if (apply) applyHunk(Number(apply.dataset.applyHunk))
        const applyLineButton = event.target.closest('[data-apply-row]')
        if (applyLineButton) applyLine(Number(applyLineButton.dataset.applyRow))
        const minimap = event.target.closest('[data-minimap-hunk]')
        if (minimap) scrollToHunk(Number(minimap.dataset.minimapHunk))
        const row = event.target.closest('.diff-row.is-removed, .diff-row.is-added')
        if (row) {
            selectedHunk = hunks.findIndex((hunk) => Number(row.dataset.row) >= hunk.start && Number(row.dataset.row) <= hunk.end)
            render()
        }
    })

    const save = async () => {
        const result = await onSave(local)
        status.textContent = result?.ok ? 'Local file saved.' : (result?.error || 'Unable to save local file.')
    }

    const onEdit = (event) => {
        const rowElement = event.target.closest('.diff-row[data-line]')
        if (!rowElement) return
        const lineIndex = Number(rowElement.dataset.line)
        const lines = local.split('\n')
        lines[lineIndex] = rowElement.querySelector('.diff-code').innerText.replace(/\n$/, '')
        local = lines.join('\n')
    }
    localPane.addEventListener('input', onEdit)
    localPane.addEventListener('focusout', () => {
        clearTimeout(renderTimer)
        renderTimer = setTimeout(compute, 0)
    })
    let scrollFrame = false
    const onPaneScroll = (source, other) => {
        if (viewMode === 'side') other.scrollTop = source.scrollTop
        const activeEditor = host.querySelector('.diff-code[contenteditable="true"]:focus')
        if (activeEditor) {
            const rowBounds = activeEditor.getBoundingClientRect()
            const paneBounds = source.getBoundingClientRect()
            if (rowBounds.bottom > paneBounds.top && rowBounds.top < paneBounds.bottom) return
            activeEditor.blur()
        }
        if (scrollFrame) return
        scrollFrame = true
        requestAnimationFrame(() => { scrollFrame = false; render() })
    }
    localPane.addEventListener('scroll', () => onPaneScroll(localPane, remotePane))
    remotePane.addEventListener('scroll', () => onPaneScroll(remotePane, localPane))
    host.querySelector('[data-diff-language]').addEventListener('change', (event) => {
        host.dataset.language = event.target.value === 'auto' ? extension : event.target.value
        render()
    })
    host.addEventListener('keydown', (event) => {
        if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); scrollToHunk(activeHunk + 1) }
        if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); scrollToHunk(activeHunk - 1) }
        if (event.target.matches('.diff-code[contenteditable="true"]') && event.key === 'Enter') {
            event.preventDefault()
            const rowElement = event.target.closest('.diff-row')
            const lineIndex = Number(rowElement.dataset.line)
            const lines = local.split('\n')
            lines.splice(lineIndex + 1, 0, '')
            local = lines.join('\n')
            compute()
        }
    })

    const resize = window.matchMedia('(max-width: 900px)')
    resize.addEventListener?.('change', (event) => { if (event.matches) viewMode = 'unified'; render() })
    compute()
    return {
        setRemote(next) { remote = String(next ?? ''); compute() },
        getLocal() { return local },
        save,
        toggleSidebar() { setSidebarVisible(sidebarButton?.getAttribute('aria-pressed') !== 'true') },
        destroy() {
            clearTimeout(renderTimer)
            worker?.terminate()
            host.innerHTML = ''
        }
    }
}
