let _settings = null
let _hideTimeout = null

export const ui = {
    init: (settings) => {
        _settings = settings?.ux?.progress || { view: 'bar', position: 'top', details: true, duration: 500 }
    },
    progress: (options) => {
        const el = document.querySelector('#app-progress')
        const title = document.querySelector('#progress-title')
        const percent = document.querySelector('#progress-percent')
        const fill = document.querySelector('#progress-fill')
        const details = document.querySelector('#progress-details')

        if (!el) return

        // Clear any existing hide timeout
        if (_hideTimeout) {
            clearTimeout(_hideTimeout)
            _hideTimeout = null
        }

        const config = _settings || { view: 'bar', position: 'top', details: true, duration: 200 }

        if (options === false) {
            _hideTimeout = setTimeout(() => {
                el.classList.add('hidden')
            }, config.duration || 0)
            return
        }

        const { show = true, value = 0, message = 'Processing...', label = 'Processing...' } = options

        // 1. Handle Hidden View
        if (config.view === 'hidden' || !show) {
            el.classList.add('hidden')
            return
        }

        // 2. Apply Position & View Classes
        el.classList.remove('hidden', 'pos-top', 'pos-center', 'pos-bottom', 'view-bar', 'view-spinner')
        el.classList.add(`pos-${config.position || 'top'}`)
        el.classList.add(`view-${config.view || 'bar'}`)

        // 3. Update Text Content
        if (title) title.textContent = label
        if (percent) percent.textContent = `${Math.round(value)}%`
        if (fill) fill.style.width = `${value}%`
        
        // 4. Handle Details Toggle
        if (details) {
            details.textContent = message
            if (config.details === false) {
                details.style.display = 'none'
            } else {
                details.style.display = 'block'
            }
        }
    }
}
