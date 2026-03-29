import { escapeHtml } from './utils.js'

export const createTerminalUi = ({ terminalHost, onExecute, getPendingCommand, setPendingCommand }) => {
    let terminalInputEl = null
    let terminalOutputEl = null
    let runCount = 0
    const ANSI_COLOR_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

    const parseAnsiColor256 = (index) => {
        const value = Number(index)
        if (!Number.isInteger(value) || value < 0 || value > 255) {
            return null
        }

        if (value < 16) {
            const map = [
                { bright: false, name: 'black' },
                { bright: false, name: 'red' },
                { bright: false, name: 'green' },
                { bright: false, name: 'yellow' },
                { bright: false, name: 'blue' },
                { bright: false, name: 'magenta' },
                { bright: false, name: 'cyan' },
                { bright: false, name: 'white' },
                { bright: true, name: 'black' },
                { bright: true, name: 'red' },
                { bright: true, name: 'green' },
                { bright: true, name: 'yellow' },
                { bright: true, name: 'blue' },
                { bright: true, name: 'magenta' },
                { bright: true, name: 'cyan' },
                { bright: true, name: 'white' }
            ]
            return { mode: 'named', ...map[value] }
        }

        if (value >= 16 && value <= 231) {
            const offset = value - 16
            const r = Math.floor(offset / 36)
            const g = Math.floor((offset % 36) / 6)
            const b = offset % 6
            const steps = [0, 95, 135, 175, 215, 255]
            return { mode: 'rgb', value: `${steps[r]}, ${steps[g]}, ${steps[b]}` }
        }

        const gray = 8 + ((value - 232) * 10)
        return { mode: 'rgb', value: `${gray}, ${gray}, ${gray}` }
    }

    const parseAnsiSgr = (token) => {
        const raw = token === '' ? ['0'] : token.split(';')
        return raw.map((part) => {
            const parsed = Number(part)
            return Number.isFinite(parsed) ? parsed : 0
        })
    }

    const renderAnsi = (text) => {
        const value = String(text || '')
        const regex = /\x1b\[([0-9;]*)m/g
        let lastIndex = 0
        let html = ''
        let match

        const state = {
            fg: null,
            bg: null,
            bold: false,
            dim: false,
            underline: false,
            inverse: false
        }

        const buildClassesAndStyle = () => {
            const classes = ['ansi']
            let style = ''

            const effectiveFg = state.inverse ? state.bg : state.fg
            const effectiveBg = state.inverse ? state.fg : state.bg

            if (state.bold) classes.push('ansi-bold')
            if (state.dim) classes.push('ansi-dim')
            if (state.underline) classes.push('ansi-underline')

            if (effectiveFg?.mode === 'named') {
                classes.push(`ansi-fg-${effectiveFg.name}${effectiveFg.bright ? '-bright' : ''}`)
            } else if (effectiveFg?.mode === 'rgb') {
                style += `color: rgb(${effectiveFg.value});`
            }

            if (effectiveBg?.mode === 'named') {
                classes.push(`ansi-bg-${effectiveBg.name}${effectiveBg.bright ? '-bright' : ''}`)
            } else if (effectiveBg?.mode === 'rgb') {
                style += `background-color: rgb(${effectiveBg.value});`
            }

            return {
                classAttr: classes.join(' '),
                styleAttr: style ? ` style="${style}"` : ''
            }
        }

        const emit = (chunk) => {
            if (!chunk) return
            const safe = escapeHtml(chunk)
            const attrs = buildClassesAndStyle()
            html += `<span class="${attrs.classAttr}"${attrs.styleAttr}>${safe}</span>`
        }

        while ((match = regex.exec(value)) !== null) {
            emit(value.slice(lastIndex, match.index))
            const codes = parseAnsiSgr(match[1])

            for (let i = 0; i < codes.length; i++) {
                const code = codes[i]
                if (code === 0) {
                    state.fg = null
                    state.bg = null
                    state.bold = false
                    state.dim = false
                    state.underline = false
                    state.inverse = false
                } else if (code === 1) {
                    state.bold = true
                } else if (code === 2) {
                    state.dim = true
                } else if (code === 4) {
                    state.underline = true
                } else if (code === 7) {
                    state.inverse = true
                } else if (code === 22) {
                    state.bold = false
                    state.dim = false
                } else if (code === 24) {
                    state.underline = false
                } else if (code === 27) {
                    state.inverse = false
                } else if (code === 39) {
                    state.fg = null
                } else if (code === 49) {
                    state.bg = null
                } else if (code >= 30 && code <= 37) {
                    state.fg = { mode: 'named', name: ANSI_COLOR_NAMES[code - 30], bright: false }
                } else if (code >= 90 && code <= 97) {
                    state.fg = { mode: 'named', name: ANSI_COLOR_NAMES[code - 90], bright: true }
                } else if (code >= 40 && code <= 47) {
                    state.bg = { mode: 'named', name: ANSI_COLOR_NAMES[code - 40], bright: false }
                } else if (code >= 100 && code <= 107) {
                    state.bg = { mode: 'named', name: ANSI_COLOR_NAMES[code - 100], bright: true }
                } else if (code === 38 || code === 48) {
                    const isForeground = code === 38
                    const colorMode = codes[i + 1]
                    if (colorMode === 5 && i + 2 < codes.length) {
                        const parsed = parseAnsiColor256(codes[i + 2])
                        if (isForeground) state.fg = parsed
                        else state.bg = parsed
                        i += 2
                    } else if (colorMode === 2 && i + 4 < codes.length) {
                        const r = Math.max(0, Math.min(255, Number(codes[i + 2]) || 0))
                        const g = Math.max(0, Math.min(255, Number(codes[i + 3]) || 0))
                        const b = Math.max(0, Math.min(255, Number(codes[i + 4]) || 0))
                        const rgb = { mode: 'rgb', value: `${r}, ${g}, ${b}` }
                        if (isForeground) state.fg = rgb
                        else state.bg = rgb
                        i += 4
                    }
                }
            }

            lastIndex = regex.lastIndex
        }

        emit(value.slice(lastIndex))
        return html || '<span class="ansi"></span>'
    }

    const append = (text, kind = 'out') => {
        if (!terminalOutputEl) return
        const prefix = kind === 'err' ? '! ' : ''
        const value = kind === 'sep' ? `${text}` : `${prefix}${text}`
        terminalOutputEl.innerHTML += `<span class="terminal-line terminal-line-${kind}">${renderAnsi(`\n${value}`)}</span>`
        terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight
    }

    const clear = () => {
        if (terminalOutputEl) {
            terminalOutputEl.innerHTML = `<span class="terminal-line terminal-line-out">${renderAnsi('$ ready')}</span>`
        }
    }

    const run = async () => {
        if (!terminalInputEl) return

        const command = terminalInputEl.value.trim()
        if (!command) return

        if (runCount > 0) {
            append('────────────────────────────────', 'sep')
        }

        append(`$ ${command}`)
        terminalInputEl.disabled = true

        try {
            const result = await onExecute(command)
            if (result.stdout) append(result.stdout.trim())
            if (result.stderr) append(result.stderr.trim(), 'err')
            append(`exit ${result.code}`)
        } catch {
            append('Could not execute command.', 'err')
        } finally {
            terminalInputEl.disabled = false
            terminalInputEl.focus()
            setPendingCommand(terminalInputEl.value)
            runCount++
        }
    }

    const render = () => {
        terminalHost.innerHTML = `
          <section class="terminal-box">
            <div class="terminal-head">
              <h3>Terminal</h3>
              <button id="terminal-clear" type="button" class="terminal-clear">Clear</button>
            </div>
            <p class="summary">Shortcuts: Ctrl+Enter run, Ctrl+L clear</p>
            <pre id="terminal-output" class="terminal-output"></pre>
            <div class="terminal-bottom">
              <p class="summary">Allowed: pull, push, script, serve, config, test</p>
              <form id="terminal-form" class="terminal-form terminal-form-sticky">
                <input id="terminal-input" class="terminal-input" type="text" value="${escapeHtml(getPendingCommand())}" autocomplete="off" />
                <button class="terminal-run" type="submit">Run</button>
              </form>
            </div>
          </section>
        `

        terminalInputEl = document.querySelector('#terminal-input')
        terminalOutputEl = document.querySelector('#terminal-output')
        clear()

        document.querySelector('#terminal-form').addEventListener('submit', async (event) => {
            event.preventDefault()
            await run()
        })

        terminalInputEl.addEventListener('keydown', async (event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 'enter') {
                event.preventDefault()
                await run()
            }
            if (event.ctrlKey && event.key.toLowerCase() === 'l') {
                event.preventDefault()
                clear()
            }
        })

        terminalInputEl.addEventListener('input', () => {
            setPendingCommand(terminalInputEl.value)
        })

        document.querySelector('#terminal-clear').addEventListener('click', clear)
    }

    const setCommand = (command) => {
        const value = String(command || '').trim()
        if (!value) return

        setPendingCommand(value)
        if (terminalInputEl) {
            terminalInputEl.value = value
            terminalInputEl.focus()
        }
    }

    const upsertLocalPath = (relativePath) => {
        const rawPath = String(relativePath || '').trim()
        if (!rawPath) return

        const normalizedPath = rawPath.startsWith('./') || rawPath.startsWith('../')
            ? rawPath
            : `./${rawPath}`
        const localValue = /\s/.test(normalizedPath) ? `"${normalizedPath}"` : normalizedPath
        const localSegment = `--local ${localValue}`
        const sourceCommand = terminalInputEl ? terminalInputEl.value : getPendingCommand()
        const baseCommand = String(sourceCommand || '').trim()
        const updated = baseCommand
            ? baseCommand.replace(/(^|\s)--local\s+(?:"[^"]*"|'[^']*'|\S+)/, `$1${localSegment}`).trim()
            : localSegment
        const command = /(^|\s)--local\s+(?:"[^"]*"|'[^']*'|\S+)/.test(baseCommand)
            ? updated
            : `${baseCommand} ${localSegment}`.trim()

        setPendingCommand(command)
        if (terminalInputEl) {
            terminalInputEl.value = command
            terminalInputEl.focus()
        }
    }

    return {
        render,
        setCommand,
        upsertLocalPath
    }
}
