import * as constants from '../constants/index.js'
import * as notifications from './notifications.js'
import * as prompt from '../../src/providers/prompt.js'
import * as context from '../services/context.js'
import * as template from './template.js'
import * as condition from './condition.js'
import * as file from './file.js'
import text from './text.js'

const _parseCredentials = (input) => {

    const regex = /^([a-zA-Z0-9-]+):\/\/([^:]+):([^@]+)@(.+)$/
    const match = input.match(regex)

    let model = {}

    if (match.length > 0) {
        model.username = match[0]
    }

    if (match.length > 1) {
        model.password = match[1]
    }

    if (match.length > 2) {
        model.tenant = match[2]
    }

    return model

}

const _parseHttp = (path) => {
    const url = new URL(`https://${path}`)

    const config = {}

    config.service = text(url.host).variable()
    const match = url.pathname.split('/').filter(p => p !== '')
    if (match.length > 0) {
        config.collection = match[0]
    }
    if (match.length > 1) {
        config.id = match[1]
    }

    config.query = {}
    url.searchParams.forEach((v, k) => config.query[k] = v)

    return config
}

const _parsePath = (path) => {

    let value = path.replace('folder://', '').replace('file://', '')
    value = file.parse(value)
    return {
        type: value.file ? 'file' : 'folder',
        config: value
    }
}

const _parseObject = (path) => {
    const config = {}

    if (path.startsWith('/')) {
        path = path.substring(1)
    }

    config.properties = path.split(',')

    return config


}

/**
 *    login https://directory/<user-name>
 *    login:auth://basic/<tenant-code>/<user-name>
 *    login:auth://{{tenant-code}}/{{username}}?password={{password}}
 * 
 *    uri
 *    file://{{path}}
 *    folder://{{path}}
 * 
 *    remote actions
 *    search:{{service-root-url}}/{{collection}}
 *    create:{{service-root-url}}/{{collection}}
 *    get:{{service-root-url}}/{{collection}}/{{id}}
 *    update:{{service-root-url}}/{{collection}}/{{id}}
 *    remove:{{service-root-url}}/{{collection}}/{{id}}
 * 
 *    remove:object://nav transofrmations
 *    patch:nav
 *    
 */
const _parse = (value, params = {}) => {
    if (typeof value !== 'string') {
        return value
    }

    /**
     * 3. Filesystem path (absolute or relative)
     *    Implicit GET + file://
     */
    if (
        value.startsWith('/') ||
        value.startsWith('./') ||
        value.startsWith('../')
    ) {
        return parseWithOperation(`file://${value}`, true)
    }

    /**
     * 2. Bare URI (https://, file://, folder://, obj://, etc.)
     *    Implicit GET
     */
    if (value.match(/^[a-zA-Z0-9+.-]+:\/\//)) {
        return parseWithOperation(value, true)
    }

    /**
     * 1. Detect explicit operation with optional suboperation
     *    Example: patch[add]:obj://title=new
     */
    const opMatch = value.match(/^([a-zA-Z]+)(?:\[([a-zA-Z]+)\])?:/)
    if (opMatch) {
        return parseWithOperation(value)
    }

    return value
}

/**
 * --- helpers ---
 */

const parseWithOperation = (value, skipOperation) => {
    const model = {}

    let uriPart = value

    if (!skipOperation) {
        const opMatch = value.match(/^([a-zA-Z]+)(?:\[([a-zA-Z]+)\])?:/)
        const operation = opMatch[1]
        const suboperation = opMatch[2]

        model.operation = operation
        if (suboperation) {
            model.suboperation = suboperation
        }

        uriPart = value.slice(opMatch[0].length)
    }

    const uriMatch = uriPart.match(/^([a-zA-Z0-9+.-]+):\/\/(.+)$/)
    if (!uriMatch) {
        throw new Error(`Invalid URI syntax: ${value}`)
    }

    const type = uriMatch[1]
    let remainder = uriMatch[2]

    model.resource = { type }

    // Inline value (patch add/replace)
    if (remainder.includes('=')) {
        const idx = remainder.indexOf('=')
        model.resource.path = normalizePath(remainder.slice(0, idx))
        model.value = remainder.slice(idx + 1)
    } else {
        model.resource.path = normalizePath(remainder)
    }

    const placeholders = extractPlaceholders(value)
    if (placeholders.length) {
        model.placeholders = placeholders
    }

    if (model.resource.type === 'http' || model.resource.type === 'https') {
        model.resource.config = _parseHttp(model.resource.path)
    }

    if (model.resource.type === 'obj') {
        model.resource.config = _parseObject(model.resource.path)
    }


    if (model.resource.type === 'file' || model.resource.type === 'folder') {
        const parsedPath = _parsePath(model.resource.path)
        model.resource.type = parsedPath.type
        model.resource.config = parsedPath.config
    }

    return model
}

const normalizePath = (path) => {
    return path // path.startsWith('/') ? path : '/' + path
}

const extractPlaceholders = (str) => {
    return [...str.matchAll(/\$\{([^}]+)\}/g)].map(m => m[1])
}


const _getValueFromParams = (item, params) => {
    let key = item.name
    let value
    if (params && params[key]) {
        value = params[key]
    }

    if (!value) {
        // check if the value is already passed in the job
        const valueIndex = process.argv.indexOf(`--${key}`)
        if (valueIndex !== -1 && process.argv[valueIndex + 1]) {
            value = process.argv[valueIndex + 1]
        }
    }

    if (!value && key === 'cwd') {
        value = context.paths('$cwd')
    }

    if (value && typeof value === 'string') {
        value = _parse(value)
    }

    if (item.type === 'placeholder') {
        return value
    }

    if (value) {
        return { [key]: value }
    }
}

const _nextPrompt = (item, value) => {
    let next

    if (item.next) {
        next = item.next
    }

    if (item.choices) {
        let choice = item.choices.find(c => c.value ? c.value === value : c === value)

        if (choice && choice.next) {
            next = choice.next
        }
    }

    if (next) {
        if (!Array.isArray(next)) {
            next = [next]
        }

        next = next.filter(n => {
            if (n.condition) {
                if (!condition.check(value, n.condition)) {
                    return false
                }
            }

            if (n.permissions && !context.hasPermission(n.permissions)) {
                return false
            }

            return true
        })
    }

    return next
}

const _get = async (item, params) => {

    // check if the value exists
    let value = _getValueFromParams(item, params)
    if (!value) {
        // get form the user

        switch (item.type) {
            case 'text':
                {
                    let output = await prompt.input(item.message, item)
                    value = { [item.name]: output }
                }
                break

            case 'email':
                {
                    let output = await prompt.input(item.message, {
                        check: (text) => {
                            const emailRegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                            if (!text) {
                                return 'Email is required'
                            }
                            if (!emailRegExp.test(text)) {
                                return 'Please enter a valid email address (e.g., name@domain.com)'
                            }
                            return null // Return null if the input is valid
                        }
                    })
                    value = { [item.name]: output }
                }
                break

            case 'password':
                {
                    let output = await prompt.secret(item.message)
                    value = { [item.name]: output }
                }
                break

            case 'file':
                {
                    let path = await prompt.file(item.message, item.config?.filters)

                    if (path) {
                        notifications.data('Selected', path)
                        value = { [item.name]: path }
                    }
                }
                break

            case 'folder':
            case 'directory':
                {
                    let path = await prompt.folder(item.message)
                    if (path) {
                        notifications.data('Selected', path)
                        value = { [item.name]: path }
                    }
                }
                break

            case 'services':
                {
                    let selected = await prompt.select(item.message, context.application().services.map(s => {
                        return {
                            name: s.name || s.code,
                            value: s.code
                        }
                    }))
                    if (selected) {
                        notifications.data('Selected', selected)
                        value = { [item.name]: selected }
                    }
                }
                break

            case 'commands':
                {
                    let selected = await prompt.select(constants.actions.search().map(s => {
                        return {
                            name: s.name || s.code,
                            value: s.code
                        }
                    }))
                    if (selected) {
                        notifications.data('Selected', selected)
                        value = { [item.name]: selected }
                    }
                }
                break

            case 'placeholder':
                value = {}
                break

            default:
                throw new Error('INPUT_INV', { cause: { type: item.type } })
        }
    }
    params = Object.assign({}, params, value)

    let next = _nextPrompt(item, params)

    if (next) {
        if (!Array.isArray(next)) { next = [next] }

        for (const n of next) {
            let nextValue = await _get(n, params)
            value = Object.assign(value, nextValue)
            params = Object.assign({}, params, value)
        }
    }
    return value
}

export const get = async (prompt, params) => {

    let item = prompt

    if (typeof item === 'string') {
        item = constants.inputs.get(prompt)

        if (!item) {
            item = {
                code: prompt,
                name: prompt,
                type: 'input',
                message: prompt
            }
        }
    }
    let value = (params || {})[item.code]

    if (!value) {
        value = await _get(item, params)
    }

    let format = item.format
    if (format) {
        if (typeof format !== 'string') {
            format = JSON.stringify(format)
        }
        let formatted = template.formatter(format).inject({
            data: value
        }).replace(/\\/g, '\\\\')
        return JSON.parse(formatted)
    }

    return (typeof value === 'object') ? value[item.name] : value
}

export const parse = (value, type) => {
    return _parse(value, type)
}

export const web = async (url) => {
    await prompt.navigate(url)
}
