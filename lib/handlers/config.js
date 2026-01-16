import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'
import { settings } from '../helpers/data.js'
import * as notifications from '../helpers/notifications.js'

const parseValue = (value) => {
    if (typeof value !== 'string') return value

    const trimmed = value.trim()

    // Boolean
    if (trimmed.toLowerCase() === 'true') return true
    if (trimmed.toLowerCase() === 'false') return false

    // Number (integer or float)
    // @ts-ignore
    if (!isNaN(trimmed) && trimmed !== '') {
        return Number(trimmed)
    }

    // Return original string
    return trimmed
}

/**
 * sets or gets the local config.
 *
 * @param {Object} params - The options for the push process.
 * example
 * oa config logger.level           // gets the value
 * oa config logger.level fatal     // sets the value
 */
export const execute = async (params) => {
    logger('handlers.config').verbose('execute')
    if (params.value !== undefined) {
        settings.set(params.key, params.value, { encrypt: params.encrypt || params.e })
    } else {
        params.value = settings.get(params.key, { decrypt: false })
    }

    notifications.data(params.key, params.value)
}

export const parse = (args) => {
    const paramCount = args.length
    const params = {}

    if (paramCount > 0) {
        params.key = input.parse(args[0])
    }
    // oa config logger.level "fatal"   // sets the value
    if (paramCount > 1) {
        params.value = parseValue(args[1])
    }

    return params
}
