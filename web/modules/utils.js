export const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export const formatRemaining = (ms) => {
    if (ms == null) return 'Unknown'
    if (ms <= 0) return 'Expired'

    const totalSeconds = Math.floor(ms / 1000)
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

export const buildAbsoluteUrl = (rawPath) => {
    const value = String(rawPath || '')
    if (!value) return ''
    if (value.startsWith('http://') || value.startsWith('https://')) return value
    return new URL(value.startsWith('/') ? value : `/${value}`, window.location.origin).href
}

export const copyText = async (value, trigger) => {
    const text = String(value || '')
    if (!text) {
        return false
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
        } else {
            throw new Error('Clipboard API unavailable')
        }

        if (trigger) {
            const previous = trigger.textContent
            trigger.textContent = 'Copied'
            trigger.classList.add('is-copied')
            window.setTimeout(() => {
                trigger.textContent = previous
                trigger.classList.remove('is-copied')
            }, 1200)
        }
        return true
    } catch {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', 'readonly')
        area.style.position = 'absolute'
        area.style.left = '-9999px'
        document.body.appendChild(area)
        area.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(area)

        if (copied) return true
        window.prompt('Copy this path:', text)
        return false
    }
}

export const getFileIcon = (fileName) => {
    const ext = String(fileName || '').toLowerCase().split('.').pop()
    if (ext === 'json') return '{}'
    if (ext === 'html') return '</>'
    if (ext === 'txt') return 'TXT'
    if (ext === 'md') return 'MD'
    return '\ud83d\udcc4'
}
