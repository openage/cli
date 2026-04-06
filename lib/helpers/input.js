import * as constants from '../constants/index.js'
import * as notifications from './notifications.js'
import * as prompt from '../../src/providers/prompt.js'
import * as context from '../services/context.js'
import * as template from './template.js'
import * as condition from './condition.js'
import * as file from './file.js'
import text from './text.js'
import logger from './logger.js'

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
    const log = logger('helpers.input.parse')
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
        log.silly('Filesystem', value)
        return parseWithOperation(`file://${value}`, true)
    }

    /**
     * 2. Bare URI (https://, file://, folder://, obj://, etc.)
     *    Implicit GET
     */
    if (value.match(/^[a-zA-Z0-9+.-]+:\/\//)) {
        log.silly('Bare URI', value)
        return parseWithOperation(value, true)
    }

    /**
     * 1. Detect explicit operation with optional suboperation
     *    Example: patch[add]:obj://title=new
     */
    if (value.match(/^([a-zA-Z]+)(?:\[([a-zA-Z]+)\])?:/)) {
        log.silly('Operation', value)
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
    if (model.resource.type === 'obj' && remainder.includes('=')) {
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

            case 'confirm':
                {
                    let output = await prompt.confirm(item.message)
                    value = { [item.name]: output }
                }
                break

            case 'list':
                {
                    const choices = item.choices || []
                    let output = await prompt.select(item.message, choices)
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
                    const choices = constants.actions.search().map(s => {
                        return {
                            name: `${s.code.padEnd(10)} | ${s.description || s.title || ''}`,
                            value: s.code
                        }
                    })
                    let selected = await prompt.select('Select a command:', choices)
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

/**
 * Parses a string-based prompt definition into a structured object.
 * Supports two main formats:
 * 1. Full Format: `[type] key=defaultValue: Message`
 * 2. Shorthand: `email`, `password` (maps to predefined constants)
 * @param {string} prompt - The raw string representation of the prompt.
 * @returns {{type: string, name: string, value: string|null, message: string}}
 * @throws {Error} If the input is empty or does not match the required pattern.
 * @example
 * parsePrompt('[text] user=Guest: Who are you?');
 * Returns { type: 'text', name: 'user', value: 'Guest', message: 'Who are you?' }
 * @example
 * parsePrompt('[password] pass: Enter code');
 * Returns { type: 'password', name: 'pass', value: null, message: 'Enter code' }
 */

export const parsePrompt = (prompt) => {

    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Input must be a non-empty string.')
    }

    const trimmed = prompt.trim()

    // 1. Shorthand Check
    // If input matches a predefined constant code (shorthand), return it.
    const item = constants.inputs.get(trimmed)
    if (item) {
        return item
    }

    // 2. Full Regex Implementation
    // [(\w+)]     -> Group 1: The type inside brackets
    // \s*(\w+)    -> Group 2: The key/name
    // (?:=(.*?))? -> Group 3: Optional default value after '='
    // \s*:\s* -> Delimiter: Colon with optional surrounding whitespace
    // (.*)        -> Group 4: The remainder of the string as the message
    const regex = /\[(\w+)\]\s*(\w+)(?:=(.*?))?\s*:\s*(.*)/
    const match = trimmed.match(regex)

    if (!match) {
        throw new Error('Invalid format. Use [type] key=default: Message')
    }

    return {
        type: match[1],
        name: match[2],
        value: match[3] ? match[3].trim() : null,
        message: match[4].trim()
    }

}

export const get = async (prompt, params) => {

    let item = prompt

    if (typeof item === 'string') {
        item = parsePrompt(prompt)
    }
    let value = (params || {})[item.name]

    if (!value) {
        value = await _get(item, params)
    }

    if (!value) {
        value = {}
        value[item.name] = item.value
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
