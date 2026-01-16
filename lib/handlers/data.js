import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'
import * as data from '../helpers/data.js'
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
 * sets or gets the data.
 *
 * @param {Object} params - The options for the push process.
 * example
 * oa data input:user.email                     // gets the value
 * oa data input                                // gets all the values in input file
 * oa data input:user.email email@example.com
 * oa data input:user.secret abc --encrypt      // sets the value and encrypts it
 */
export const execute = async (params) => {
    logger('handlers.data').verbose('execute')

    let store = data[params.store]
    let value
    if (params.value === undefined) {
        value = store.get(params.key, { decrypt: false })
    } else {
        value = parseValue(params.value)
        store.set(params.key, value, { encrypt: params.encrypt || params.e })

    }
    return notifications.data(params.key, value)
}

export const parse = (args) => {
    const paramCount = args.length
    const params = {}

    if (paramCount > 0) {
        const parts = args[0].split(':')
        params.store = parts[0]
        if (parts.length > 0) {
            params.key = parts[1]
        }
    }
    if (paramCount > 1) {
        params.value = parseValue(args[1])
    }

    return params
}
