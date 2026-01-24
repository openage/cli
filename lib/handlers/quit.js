import * as context from '../services/context.js'
import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'

/**
 * Processes the quit operation by clearing the context and exiting the application.
 *
 * @param {Object} options - The options for the quit process.
 */
export const execute = async (options) => {
    logger('handlers.logout').silly('execute')

    let clean = await input.get('clean')
    if (clean) {
        context.clear()
    }
    return process.exit(0)
}
