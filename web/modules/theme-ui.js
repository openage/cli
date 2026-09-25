import { themes, themeColors } from './theme-data.js'

export const createThemeUi = () => {
    let currentCode = 'ms-fabric'
    let currentMode = 'dark'
    let currentColor = 'default'
    let isPanelOpen = false
    let isInitialized = false

    const getSystemMode = () => {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }

    const saveToServer = async (key, value) => {
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            })
        } catch {
            // ignore network/save failure
        }
    }

    const updateModeButtonIcon = (actualMode) => {
        const modeBtn = document.querySelector('#theme-mode-btn')
        if (!modeBtn) return

        if (actualMode === 'light') {
            modeBtn.innerHTML = `
                <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
                <span id="theme-mode-label">Switch to Dark Mode</span>
            `
            modeBtn.title = 'Switch to Dark Mode'
            modeBtn.setAttribute('aria-label', 'Switch to Dark Mode')
        } else {
            modeBtn.innerHTML = `
                <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: none;">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <span id="theme-mode-label">Switch to Light Mode</span>
            `
            modeBtn.title = 'Switch to Light Mode'
            modeBtn.setAttribute('aria-label', 'Switch to Light Mode')
        }
    }

    const updatePanelActiveStates = () => {
        // Mode tabs
        document.querySelectorAll('.theme-mode-tab').forEach((tab) => {
            const tabMode = tab.dataset.mode
            if (tabMode === currentMode) {
                tab.classList.add('active')
                tab.setAttribute('aria-selected', 'true')
            } else {
                tab.classList.remove('active')
                tab.setAttribute('aria-selected', 'false')
            }
        })

        // Theme preset cards
        document.querySelectorAll('.theme-preset-card').forEach((card) => {
            const cardTheme = card.dataset.theme
            if (cardTheme === currentCode) {
                card.classList.add('active')
                card.setAttribute('aria-selected', 'true')
            } else {
                card.classList.remove('active')
                card.setAttribute('aria-selected', 'false')
            }
        })

        // Color swatches
        document.querySelectorAll('.theme-color-swatch').forEach((swatch) => {
            const swatchColor = swatch.dataset.color
            if (swatchColor === currentColor) {
                swatch.classList.add('active')
                swatch.setAttribute('aria-selected', 'true')
            } else {
                swatch.classList.remove('active')
                swatch.setAttribute('aria-selected', 'false')
            }
        })
    }

    const apply = (themeCode, themeMode, colorCode, persist = true) => {
        currentCode = themeCode || currentCode || 'ms-fabric'
        currentMode = themeMode || currentMode || 'dark'
        currentColor = colorCode || currentColor || 'default'

        let actualMode = currentMode
        if (actualMode === 'system') {
            actualMode = getSystemMode()
        }

        const theme = themes[currentCode] || themes['ms-fabric'] || themes['one-dark-pro']
        const colors = theme[actualMode] || theme['dark']

        // Apply theme variables
        Object.entries(colors).forEach(([variable, value]) => {
            document.documentElement.style.setProperty(variable, value)
        })

        // Apply custom accent color override if selected
        if (currentColor && currentColor !== 'default') {
            const foundColor = themeColors.find((c) => c.code === currentColor)
            if (foundColor && foundColor.hex) {
                document.documentElement.style.setProperty('--primary', foundColor.hex)
                if (foundColor.strong) {
                    document.documentElement.style.setProperty('--primary-strong', foundColor.strong)
                }
                if (foundColor.soft) {
                    document.documentElement.style.setProperty('--primary-soft', foundColor.soft)
                }
            }
        }

        // Set root attributes
        document.documentElement.setAttribute('data-theme', currentCode)
        document.documentElement.setAttribute('data-mode', actualMode)
        document.documentElement.setAttribute('data-color', currentColor)

        updateModeButtonIcon(actualMode)
        updatePanelActiveStates()

        if (persist) {
            try {
                localStorage.setItem('oa-theme', JSON.stringify({
                    code: currentCode,
                    mode: currentMode,
                    color: currentColor
                }))
            } catch {
                // ignore storage error
            }

            saveToServer('ux.theme.code', currentCode)
            saveToServer('ux.theme.mode', currentMode)
            saveToServer('ux.theme.color', currentColor)
        }
    }

    const toggleMode = () => {
        let actual = currentMode
        if (actual === 'system') {
            actual = getSystemMode()
        }
        const nextMode = actual === 'dark' ? 'light' : 'dark'
        apply(currentCode, nextMode, currentColor, true)
    }

    const openPanel = () => {
        const panel = document.querySelector('#theme-panel')
        if (!panel) return

        panel.classList.remove('hidden')
        isPanelOpen = true
        updatePanelActiveStates()
    }

    const closePanel = () => {
        const panel = document.querySelector('#theme-panel')
        if (!panel) return

        panel.classList.add('hidden')
        isPanelOpen = false
    }

    const togglePanel = () => {
        if (isPanelOpen) {
            closePanel()
        } else {
            openPanel()
        }
    }

    const renderColorsPalette = () => {
        const container = document.querySelector('#theme-colors-palette')
        if (!container) return

        container.innerHTML = themeColors.map((color) => {
            const isDefault = color.code === 'default'
            const style = isDefault
                ? 'background: linear-gradient(135deg, var(--primary), var(--primary-strong));'
                : `background: ${color.hex};`
            return `
                <button type="button" class="theme-color-swatch" data-color="${color.code}" title="${color.name}" aria-label="${color.name}">
                    <span class="swatch-circle" style="${style}"></span>
                    <span class="swatch-check">&#x2713;</span>
                </button>
            `
        }).join('')
    }

    const bindEvents = () => {
        const modeBtn = document.querySelector('#theme-mode-btn')
        modeBtn?.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleMode()
        })

        const pickerBtn = document.querySelector('#theme-picker-btn')
        pickerBtn?.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            togglePanel()
        })

        const closeBtn = document.querySelector('#theme-panel-close')
        closeBtn?.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            closePanel()
        })

        // Prevent clicks inside panel from closing it
        const panel = document.querySelector('#theme-panel')
        panel?.addEventListener('click', (e) => {
            e.stopPropagation()
        })

        // Dismiss when clicking outside panel and outside picker button
        document.addEventListener('click', (event) => {
            if (!isPanelOpen) return
            const p = document.querySelector('#theme-panel')
            const btn = document.querySelector('#theme-picker-btn')

            if (p && !p.contains(event.target) && btn && !btn.contains(event.target)) {
                closePanel()
            }
        })

        // Mode tabs
        document.querySelectorAll('.theme-mode-tab').forEach((tab) => {
            tab.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                const mode = tab.dataset.mode
                if (mode) apply(currentCode, mode, currentColor, true)
            })
        })

        // Preset cards
        document.querySelectorAll('.theme-preset-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                const theme = card.dataset.theme
                if (theme) apply(theme, currentMode, currentColor, true)
            })
        })

        // Color swatches (delegated on container)
        const colorsContainer = document.querySelector('#theme-colors-palette')
        colorsContainer?.addEventListener('click', (event) => {
            event.stopPropagation()
            const swatch = event.target.closest('.theme-color-swatch')
            if (!swatch) return
            const color = swatch.dataset.color
            if (color) apply(currentCode, currentMode, color, true)
        })

        // Listen for OS system theme change if in auto/system mode
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
                if (currentMode === 'system') {
                    apply(currentCode, 'system', currentColor, false)
                }
            })
        }
    }

    const init = (settings) => {
        let initialCode = currentCode
        let initialMode = currentMode
        let initialColor = currentColor

        if (!isInitialized) {
            // 1. Try localStorage
            try {
                const localSaved = localStorage.getItem('oa-theme')
                if (localSaved) {
                    const parsed = JSON.parse(localSaved)
                    if (parsed.code) initialCode = parsed.code
                    if (parsed.mode) initialMode = parsed.mode
                    if (parsed.color) initialColor = parsed.color
                }
            } catch {
                // ignore
            }

            // 2. Try settings if not in localStorage
            if (settings) {
                const codeFromSettings = settings?.['ux']?.['theme']?.['code'] || settings?.['ux.theme.code']
                const modeFromSettings = settings?.['ux']?.['theme']?.['mode'] || settings?.['ux.theme.mode']
                const colorFromSettings = settings?.['ux']?.['theme']?.['color'] || settings?.['ux.theme.color']

                if (codeFromSettings && !localStorage.getItem('oa-theme')) initialCode = codeFromSettings
                if (modeFromSettings && !localStorage.getItem('oa-theme')) initialMode = modeFromSettings
                if (colorFromSettings && !localStorage.getItem('oa-theme')) initialColor = colorFromSettings
            }

            renderColorsPalette()
            bindEvents()
            isInitialized = true
        } else if (settings && !localStorage.getItem('oa-theme')) {
            const codeFromSettings = settings?.['ux']?.['theme']?.['code'] || settings?.['ux.theme.code']
            const modeFromSettings = settings?.['ux']?.['theme']?.['mode'] || settings?.['ux.theme.mode']
            const colorFromSettings = settings?.['ux']?.['theme']?.['color'] || settings?.['ux.theme.color']

            if (codeFromSettings) initialCode = codeFromSettings
            if (modeFromSettings) initialMode = modeFromSettings
            if (colorFromSettings) initialColor = colorFromSettings
        }

        apply(initialCode, initialMode, initialColor, false)
    }

    const instance = {
        init,
        apply,
        toggleMode,
        openPanel,
        closePanel,
        togglePanel,
        getCurrent: () => ({ code: currentCode, mode: currentMode, color: currentColor })
    }

    window.themeUi = instance
    return instance
}
