import { escapeHtml } from './utils.js'

export const createGitUi = ({ statusBar }) => {
    let gitPopup = null

    const ensureGitPopup = () => {
        if (gitPopup) return gitPopup

        gitPopup = document.createElement('div')
        gitPopup.className = 'git-popup hidden'
        gitPopup.innerHTML = `
          <div class="git-popup-head">
            <strong>Git Controls</strong>
            <button type="button" class="git-close" data-git-close>Close</button>
          </div>
          <div class="git-meta">
            <div><span>Branch</span><strong data-git-branch>N/A</strong></div>
            <div><span>Changed</span><strong data-git-changed>0</strong></div>
            <div><span>Staged</span><strong data-git-staged>0</strong></div>
          </div>
          <p class="git-last" data-git-last>Last commit: N/A</p>
          <div class="git-actions">
            <button type="button" data-git-action="stage">Stage All</button>
            <button type="button" data-git-action="unstage">Unstage All</button>
            <button type="button" data-git-action="revert">Revert Working</button>
          </div>
          <div class="git-commit">
            <input type="text" id="git-commit-message" placeholder="Commit message" />
            <button type="button" data-git-action="commit">Commit</button>
          </div>
          <p class="git-feedback" data-git-feedback></p>
        `

        document.body.appendChild(gitPopup)

        gitPopup.addEventListener('click', async (event) => {
            const close = event.target.closest('[data-git-close]')
            if (close) {
                gitPopup.classList.add('hidden')
                return
            }

            const actionBtn = event.target.closest('[data-git-action]')
            if (!actionBtn) return

            const action = actionBtn.dataset.gitAction
            if (action === 'revert' && !window.confirm('Revert all unstaged working-tree changes?')) {
                return
            }

            let message = ''
            if (action === 'commit') {
                const input = gitPopup.querySelector('#git-commit-message')
                message = input.value.trim()
                if (!message) {
                    gitPopup.querySelector('[data-git-feedback]').textContent = 'Commit message is required.'
                    return
                }
            }

            await runGitAction(action, message)
        })

        document.addEventListener('click', (event) => {
            if (!gitPopup || gitPopup.classList.contains('hidden')) return
            if (event.target.closest('.git-popup') || event.target.closest('[data-open-git]')) return
            gitPopup.classList.add('hidden')
        })

        return gitPopup
    }

    const updateGitPopup = (summary) => {
        const popup = ensureGitPopup()
        popup.querySelector('[data-git-branch]').textContent = summary.branch || 'N/A'
        popup.querySelector('[data-git-changed]').textContent = String(summary.totalChanged ?? 0)
        popup.querySelector('[data-git-staged]').textContent = String(summary.stagedCount ?? 0)
        popup.querySelector('[data-git-last]').textContent = `Last commit: ${summary.lastCommitMessage || 'N/A'}`
    }

    const upsertGitStatus = (summary) => {
        let gitItem = statusBar.querySelector('[data-status-item="git"]')
        if (!gitItem) {
            gitItem = document.createElement('button')
            gitItem.type = 'button'
            gitItem.className = 'status-item status-item-button'
            gitItem.dataset.statusItem = 'git'
            gitItem.dataset.openGit = 'true'
            statusBar.appendChild(gitItem)
        }

        const changed = summary.totalChanged ?? 0
        const staged = summary.stagedCount ?? 0
        gitItem.innerHTML = `
          <span class="status-label">Git:</span>
          <span class="status-value">${escapeHtml(summary.branch || 'N/A')} | C${changed} | S${staged}</span>
        `

        updateGitPopup(summary)
    }

    const loadGitStatus = async () => {
        try {
            const res = await fetch('/api/git/status')
            if (!res.ok) return
            const summary = await res.json()
            upsertGitStatus(summary)
        } catch {
            // ignore
        }
    }

    const runGitAction = async (action, message = '') => {
        const popup = ensureGitPopup()
        const feedback = popup.querySelector('[data-git-feedback]')
        feedback.textContent = `Running ${action}...`

        try {
            const res = await fetch('/api/git/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, message })
            })
            const result = await res.json()

            if (!result.ok) {
                feedback.textContent = result.stderr || 'Git action failed.'
                return
            }

            feedback.textContent = result.stdout?.trim() || `${action} completed.`
            upsertGitStatus(result.summary || { branch: 'N/A', totalChanged: 0, stagedCount: 0, lastCommitMessage: 'N/A' })

            if (action === 'commit') {
                popup.querySelector('#git-commit-message').value = ''
            }
        } catch {
            feedback.textContent = 'Could not execute git action.'
        }
    }

    const bindStatusBarToggle = () => {
        statusBar.addEventListener('click', (event) => {
            const gitTrigger = event.target.closest('[data-open-git]')
            if (!gitTrigger) return
            ensureGitPopup().classList.toggle('hidden')
        })
    }

    return {
        ensureGitPopup,
        loadGitStatus,
        bindStatusBarToggle
    }
}
