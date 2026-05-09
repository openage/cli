import { paths } from '../../src/providers/context.js'
import * as data from '../helpers/data.js'
import * as file from '../helpers/file.js'
import * as httpHelper from '../helpers/http.js'
import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'
import * as notifications from '../helpers/notifications.js'
import * as template from '../helpers/template.js'
import text from '../helpers/text.js'
import * as context from '../services/context.js'
import * as specs from '../services/specs.js'

const settings = data.settings
const inputData = data.input
const responseData = data.response

const getValidationHandler = async (validation) => {
    let handler = 'field'
    if (validation.schema) {
        handler = 'schema'
    }

    return await import(`../validators/${handler}.js`)
}

function extractKeys(src, spec) {
    const keys = new Set()

    function walk(node) {
        if (typeof node === 'string') {
            const matches = node.match(/{{\s*([^}]+)\s*}}/g)
            if (matches) {
                matches.forEach(m => {
                    const variable = m.replace(/{{\s*|\s*}}/g, '').trim()
                    switch (src) {
                        case 'prompt':
                            if (variable.startsWith('prompt.')) {
                                keys.add(variable.replace(/^prompt\./, ''))
                            } else {
                                // detect prompt.* anywhere inside expression (e.g., subexpressions)
                                const re = /prompt\.([A-Za-z0-9_-]+)/g
                                let mm
                                while ((mm = re.exec(variable)) !== null) {
                                    keys.add(mm[1])
                                }
                            }
                            break

                        case 'response':
                            if (variable.startsWith('response.')) {
                                keys.add(variable.replace(/^response\./, '').split('.')[0])
                            } else {
                                // detect response.* anywhere inside expression (e.g., (lookup response.foo 0))
                                const re = /response\.([A-Za-z0-9_-]+)/g
                                let mm
                                while ((mm = re.exec(variable)) !== null) {
                                    keys.add(mm[1])
                                }
                            }
                            break
                    }
                })
            }
        } else if (Array.isArray(node)) {
            node.forEach(walk)
        } else if (node && typeof node === 'object') {
            Object.values(node).forEach(walk)
        }
    }

    walk(spec)
    return Array.from(keys)
}

const showResults = (results) => {
    notifications.data('Result', {
        headers: ['Result', 'Field', 'Actual', 'Expected'],
        rows: results.map(r => {
            const row = []
            switch (r.result) {
                case 'pass':
                    row.push(' ✔ PASS ')
                    break
                case 'fail':
                    row.push(' ✖ FAIL ')
                    break
                default:
                    row.push(' ⚠ UNKNOWN ')
                    break
            }
            row.push(r.field)
            row.push(r.actual)
            row.push(r.expected ? r.expected : '')
            return row
        })
    }, {
        view: 'tabular',
        conditions: {
            '0': [{
                value: ' ✔ PASS ',
                style: 'success'
            }, {
                value: ' ✖ FAIL ',
                style: 'error'
            }, {
                value: ' ⚠ UNKNOWN ',
                style: 'warn'
            }]
        }
    })
}

const showSummary = (spec, results) => {
    notifications.message(`\n Specification: ${text(spec.name || spec.code).toString('title')} `, 'info-highlighted')
    const passed = results.filter(r => r.result === 'pass').length
    const failed = results.filter(r => r.result === 'fail').length
    const unknown = results.filter(r => r.result !== 'pass' && r.result !== 'fail').length
    notifications.message(`✔  Passed: ${passed}`, 'success')
    notifications.message(`✖  Failed: ${failed}`, 'error')
    notifications.message(`⚠ Unknown: ${unknown}`, 'warn')
}

/**
 * Processes the push operation by sending data to a remote source and managing local configurations.
 *
 * @param {Object} params - The options for the push process.
 * support for commands like
 * oa test specs/directory/sessions/create.json 
 * oa test specs/directory/sessions 
 * oa test create-session 
 */
export const execute = async (params) => {
    let log = logger('handlers.test.execute')
    log.silly('params', params)
    if (params.code) {
        const result = await run(params)
        specs.status(result.spec.code, result.status)

        if (settings.getOrSet('test.show.summary', true)) {
            showSummary(result.spec, result.validations)
        }
        if (settings.getOrSet('test.show.response', false)) {
            notifications.data('Response', result.response)
        }

        if (settings.getOrSet('test.show.details', 'table')) {
            showResults(result.validations)
        }
        return result
    }

    if (params.files) {
        for (const path of params.files) {
            const spec = file.read(path)

            if (!spec.code) {
                spec.code = path
                    .replace(paths('$specs'), '')
                    .replace('.json', '')
                    .split(/[\\/]/) // Split by either backslash OR forward slash
                    .filter(Boolean) // Remove empty strings from leading/trailing slashes
                    .join('-')
                    .toLowerCase()
            }

            spec.name = text(spec.name || spec.code).toString('title') // text(json.name ?? uri.path.split('/').join(' ')).toString('title')
            specs.register({
                code: spec.code,
                name: spec.name,
                path: path
            })
            const result = await run({ spec: spec })
            specs.status(result.spec.code, result.status)

            if (settings.getOrSet('test.show.summary', true)) {
                showSummary(spec, result.validations)
            }

            if (settings.getOrSet('test.show.response', false)) {
                notifications.data('Response', result.response)
            }

            if (settings.getOrSet('test.show.details', 'table')) {
                showResults(result.validations)
            }
        }
    }
}
export const run = async (params) => {
    let log = logger('handlers.test.run')

    let raw

    if (params.spec && params.spec.code && !specs.has(params.spec.code)) {
        specs.register({
            code: params.spec.code,
            name: params.spec.name || params.spec.code,
            path: params.spec.path
        })
    }

    if (params.code) {
        raw = specs.get(params.code)
    } else if (params.spec) {
        raw = params.spec
    }

    const injectables = {
        context: context.toObject(),
        input: inputData.get(null),
        prompt: {},
        response: {}
    }

    const prompts = []

    for (const key of extractKeys('prompt', raw)) {
        const prompt = input.parsePrompt(key)
        prompts.push({
            key: key,
            name: prompt.name
        })
        injectables.prompt[prompt.name] = await input.get(prompt)
    }

    for (const key of extractKeys('response', raw)) {
        let output = responseData.get(key)
        if (!output) {
            await run({ code: key })
        }
        injectables.response[key] = responseData.get(key)
    }

    let url = raw.request?.url

    const serviceUrl = settings.get('service.root')

    if (serviceUrl && url) {

        const match = url.match(/\$\{([a-zA-Z0-9_.-]+)\}/)
        let serviceCode = match ? match[1] : null

        if (serviceCode) {
            url = url.replace(`:${serviceCode}`, serviceUrl).replace('${' + serviceCode + '}', serviceUrl)
        }

        raw.request.url = url
    }

    let specStringified = JSON.stringify(raw)

    prompts.forEach(p => {
        specStringified = specStringified.replace(p.key, p.name)
    })

    const spec = template.formatter(JSON.parse(specStringified)).inject(injectables)

    log.silly('request', spec.request)

    let response

    try {
        response = await httpHelper.execute(spec.request, context)
        responseData.set(raw.code, response.data)
    } catch (err) {
        log.error(err)
        notifications.error(err)
        response = err.cause?.details || err.details || {}
        if (response?.data) {
            responseData.set(raw.code, response.data)
        }
    }
    log.silly('response', response)

    const validations = spec.validations || []

    if (!validations.find(v => v.field === 'status')) {
        validations.unshift({
            field: 'status',
            operator: 'eq',
            value: 200
        })
    }

    const results = []
    let status = 'passing'
    for (const validation of validations) {
        const validator = await getValidationHandler(validation)
        const test = validator.validate(validation, response)
        results.push(...test)
        if (test.find(t => t.result === 'fail')) {
            status = 'failing'
            break
        }
    }

    return {
        status,
        spec,
        response,
        validations: results
    }

    // alert.showResults(spec, response, results, options)
}

export const parse = (args) => {
    const paramCount = args.length
    const params = {}

    if (paramCount > 0) {
        const param1 = input.parse(args[0])
        if (typeof param1 === 'string') {
            params.code = param1
        } else {
            switch (param1.resource?.type) {
                case 'file':
                case 'folder':
                    params.files = file.find(param1.resource, {
                        exclude: {
                            folders: [
                                '.oa',
                                '.logs',
                                '.cache',
                                'scripts'
                            ]
                        },
                        include: {
                            folders: [
                                'specs'
                            ],
                            files: ['.json']
                        }
                    })
                    break
            }
        }
    }

    return params
}
