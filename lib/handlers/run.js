import * as notifications from '../helpers/notifications.js'
import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'
import * as constants from '../constants/index.js'

/**
 * Parses input from the request based on the configuration fields provided.
 *
 * @param {string} req - The request string to parse.
 * @param {Array<Object>} configFields - The configuration fields to extract from the request.
 * @returns {Object} The parsed key-value pairs from the request.
 */
const parseInput = (req, configFields) => {
    configFields = configFields || []

    // Extract only the configured keys from parsedParams
    const result = {}
    for (const field of configFields) {
        const regex = new RegExp(`(--${field.key}|-${field.code})\\s+("[^"]+"|[^\\s]+)`)
        const match = req.match(regex)

        if (match) {
            // Remove surrounding quotes if present
            const value = match[2].replace(/^"|"$/g, '')
            result[field.key] = value
        }
    }

    logger('handlers.run').debug('Parsed parameters:', result) // Debugging output

    return result
}

/**
 * Processes the input and executes the corresponding handler.
 *
 * @param {Object} options - The options for the process.
 * @returns {Promise<void>}
 */
export const execute = async (options) => {
    logger('handlers.run').silly('execute')

    let inputString = await input.get('run', options)
    const [actionCode, ...argsArray] = inputString.split(' ')

    const action = constants.actions.get(actionCode)
    if (!action) {
        return notifications.error(new Error('ACTION_NF', { cause: { code: actionCode } }))
    }
    // Load the corresponding handler dynamically
    let handler
    try {
        handler = await import(`../handlers/${action.handler}.js`)
    } catch (err) {
        return notifications.error(new Error('HANDLER_NF', { cause: { handler: action.handler } }))
    }

    action.config = action.config || {}

    let params = parseInput(inputString, action.config.fields)
    await handler.process(params)
}
