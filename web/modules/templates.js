export const renderExamples = (examples, escapeHtml) => {
    return examples.map((example) => `
        <li>
            <code class="inline-code">${escapeHtml(example)}</code>
            <div class="example-actions">
                <button type="button" class="copy-btn" data-copy-example="${escapeHtml(example)}">Copy</button>
                <button type="button" class="copy-btn" data-use-example="${escapeHtml(example)}">To Terminal</button>
            </div>
        </li>
    `).join('')
}

export const buildBreadcrumb = (path, escapeHtml) => {
    const segments = String(path || '').split('/').filter(Boolean)
    const crumbs = ['<button type="button" class="crumb" data-crumb-path="">Home</button>']
    let acc = ''

    segments.forEach((segment) => {
        acc = acc ? `${acc}/${segment}` : segment
        crumbs.push(`<span>/</span><button type="button" class="crumb" data-crumb-path="${escapeHtml(acc)}">${escapeHtml(segment)}</button>`)
    })

    return `<nav class="breadcrumb">${crumbs.join('')}</nav>`
}

export const buildHomeMarkup = ({ cardCommands, commandIcons, escapeHtml }) => {
    const overview = `
      <section class="card overview-card">
        ${buildBreadcrumb('', escapeHtml)}
        <div class="page-header">
          <span class="page-kicker">Workspace</span>
          <h1>Overview</h1>
        </div>
        <p class="summary">Run commands from the right terminal, browse directories from the left, and use command cards below as quick action references.</p>
      </section>
    `

    const cards = cardCommands.map((cmd, index) => {
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

    return `
      ${overview}
      <section class="card">
        <h2>Commands</h2>
        <div class="command-grid two-by-two">${cards}</div>
      </section>
    `
}
