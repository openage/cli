const constants = require('../services/constant');
const path = require('path')
const context = require('../services/context')
const template = require('./template')
const condition = require('./condition')
const file = require('./file')
const inquirer = require('inquirer');
inquirer.registerPrompt('file', require('inquirer-fuzzy-path'))
inquirer.registerPrompt('directory', require('inquirer-select-directory'))

let rootFolder = process.env.OA_CWD

const _parseCredentials = (input) => {

    const regex = /^([a-zA-Z0-9-]+):\/\/([^:]+):([^@]+)@(.+)$/;
    const match = input.match(regex);

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

const _parseApi = (input) => {

    const type = input.match(/^([a-zA-Z0-9-]+):\/\//)[1]
    const value = input.replace(`${type}://`, 'https://');

    const url = new URL(value);

    let model = {
        type: type,
        config: {}
    }
    model.config.service = url.host
    const match = url.pathname.split('/').filter(p => p !== '')
    if (match.length > 0) {
        model.config.collection = match[0]
    }
    if (match.length > 1) {
        model.config.id = match[1]
    }

    model.config.query = {}
    url.searchParams.forEach((v, k) => model.config.query[k] = v);

    return model
}

const _parsePath = (input, params) => {

    let value = input.replace('folder://', '').replace('file://', '');
    value = file.parse(value)
    return {
        type: value.file ? 'file' : 'folder',
        config: value
    }
}

/**
 *    login://{{username}}:{{password}}@{{tenant-code}}
 *    search://{{service}}/{{collection}}
 *    create://{{service}}/{{collection}}
 *    get://{{service}}/{{collection}}/{{id}}
 *    update://{{service}}/{{collection}}/{{id}}
 *    remove://{{service}}/{{collection}}/{{id}}
 *    file://{{path}}
 */
const _parse = (value, params) => {
    if (value.indexOf('://') === -1) {
        return value
    }
    let type = value.match(/^([a-zA-Z0-9-]+):\/\//)[1]

    if (!type) {
        return value
    }

    let model

    /* eslint-disable */
    switch (type) {
        case 'login':
            model = _parseCredentials(value, params)
            break
        case 'search':
        case 'create':
        case 'get':
        case 'update':
        case 'remove':
            model = _parseApi(value, params)
            break
        case 'folder':
        case 'file':
            model = _parsePath(value, params)
            break
        default:
            throw new Error(`Unsupported type: ${req.type}`)
    }

    model.type = type

    /* eslint-enable */
    return model
}


const _getFile = async (item) => {
    item.rootPath = await _getFolder(constants.inputs.get('folder'))

    let params = await inquirer.prompt([item])
    let value = params[item.name]
    value = path.normalize(value);
    if (value) {
        return { [item.name]: value }
    }
}

const _getFolder = async (item) => {
    item.basePath = rootFolder || process.cwd();

    let params = await inquirer.prompt([item]);

    let value = params[item.name]
    value = path.normalize(value);
    rootFolder = value
    if (value) {
        return { [item.name]: value }
    }
}

const _getValueFromParams = (item, params) => {
    let key = item.name
    let value
    if (params && params[key]) {
        value = params[key];
    }

    if (!value) {
        // check if the value is already passed in the job
        const valueIndex = process.argv.indexOf(`--${key}`);
        if (valueIndex !== -1 && process.argv[valueIndex + 1]) {
            value = process.argv[valueIndex + 1];
        }
    }

    if (!value && key === 'cwd') {
        value = file.cwd();
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
        /* eslint-disable */
        switch (item.type) {
            case 'file':
                value = await _getFile(item, params)
                break

            case 'folder':
            case 'directory':
                value = await _getFolder(item, params)
                break

            case 'services':
                item.type = 'list'
                item.choices = context.application().services.map(s => {
                    return {
                        name: s.name || s.code,
                        value: s.code
                    }
                })
                break

            case 'endpoints':
                item.type = 'list'
                let dependent = _getValueFromParams({ name: 'service' }, params)
                if (!dependent) {
                    dependent = await _get(constants.inputs.get('service'), params)
                }
                item.choices = constants.endpoints.get(dependent.service).map(c => {
                    return {
                        name: c.name || c.code || c,
                        value: c.value || c.code || c
                    }
                })
                break;

            case 'commands':
                item.type = 'list'
                item.choices = constants.actions.search().map(c => {
                    return {
                        name: c.title || c.name || c.code || c,
                        value: c
                    }
                })
                break;

            case 'placeholder':
                value = {};
                break;

            default:

                break;
        }
        /* eslint-enable */
        if (!value) {
            value = await inquirer.prompt([item])
        }
    }
    params = Object.assign({}, params, value);

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

exports.get = async (prompt, params) => {

    let item = prompt;

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
    let value = (params || {})[item.code];

    if (!value) {
        value = await _get(item, params);
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

    return value[item.name]
}

exports.parse = (value, type) => {
    return _parse(value, type)
}


exports.web = async (url) => {
    const open = await import('open');
    await open.default(url);
}