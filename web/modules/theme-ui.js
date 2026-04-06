import { themes } from './theme-data.js'

export const createThemeUi = () => {
    
    const apply = (themeCode, themeMode) => {
        
        let mode = themeMode || 'dark'
        if (mode === 'system') {
            mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
        }

        const theme = themes[themeCode] || themes['one-dark-pro']
        const colors = theme[mode] || theme['dark']

        Object.entries(colors).forEach(([variable, value]) => {
            document.documentElement.style.setProperty(variable, value)
        })
        
        // Also update data attributes for more specific styling if needed
        document.documentElement.setAttribute('data-theme', themeCode)
        document.documentElement.setAttribute('data-mode', mode)
    }

    const init = (settings) => {
        // Handle both nested and flat settings
        const themeCode = settings?.['ux']?.['theme']?.['code'] || settings?.['ux.theme.code'] || 'one-dark-pro'
        const themeMode = settings?.['ux']?.['theme']?.['mode'] || settings?.['ux.theme.mode'] || 'dark'
        apply(themeCode, themeMode)
    }

    return {
        init,
        apply
    }
}
