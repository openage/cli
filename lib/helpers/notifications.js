import * as provider from '../../src/providers/notification.js'

const format = (data) => {

    let key, value
    if (data?.key) {
        key = data.key
        value = data.value
    } else {
        value = data
    }

    // if (file.isPath(value)) {
    //     return chalk.blue(value)
    // }

    if (value === undefined) {
        value = '[NULL]'
    } else if (value === null) {
        value = '[Not Set]'
    } else if (value === '******') {
        value = '[REDACTED]'
    } else if (Array.isArray(value)) {
        value = `[Array(${value.length})]`
    } else {
        const type = typeof value
        switch (type) {
            case 'string':
                value = `"${value}"`
                break

            case 'boolean':
                value ? 'true' : 'false'
                break

            case 'object':
                value = '[Object]'
                break

            case 'function':
                value = '[Function]'
                break

            case 'undefined':
                value = '[Not Set]'
                break

            case 'number':
            default:
                break
        }
    }

    if (key) {
        return `${key}: ${value}`
    } else {
        return `${value}`
    }
}

// const _timestamp = () => {
//     const now = new Date()
//     const year = now.getFullYear()
//     const month = String(now.getMonth() + 1).padStart(2, '0')
//     const day = String(now.getDate()).padStart(2, '0')
//     return `${year}-${month}-${day}`
// }

const flattenObject = (obj, parentKey = '', result = {}) => {
    for (const [key, value] of Object.entries(obj)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flattenObject(value, newKey, result)
        } else {
            result[newKey] = value
        }
    }
    return result
}

export const message = (text, style) => {
    provider.message(text, style)
}

export const success = (message, data = null) => {
    provider.message(`✔ ${message}${data ? ' ' + format(data) : ''}`, 'success')
}

export const info = (message, data = null) => {
    provider.message(`ⓘ ${message}${data ? ' ' + format(data) : ''}`, 'info')
}

export const warn = (message, data = null) => {
    provider.message(`⚠ ${message}${data ? ' ' + format(data) : ''}`, 'warn')
}

export const error = (error) => {
    if (typeof error === 'string') {
        error = new Error(error)
    }
    provider.error(error)
}

export const dialog = (title, data) => {

    if (!Array.isArray(data)) {
        data = [data]
    }

    provider.dialog(title, data.map(d => format(d)).join('\n'))
}

export const data = (key, value, styles) => {
    provider.data(key, value, styles)
}

export const progress = (title, total) => {
    return provider.progress(title, total)
}
