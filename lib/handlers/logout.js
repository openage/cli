import application from '../services/application.js'
import * as context from '../services/context.js'
import * as auth from '../services/auth.js'
import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'

/**
 * Processes the logout operation by clearing the context and initializing the application and authentication.
 *
 * @param {Object} options - The options for the logout process.
 */
export const execute = async (options) => {
    logger('handlers.logout').silly('execute')

    context.clear()
    let quit = await input.get('quit')
    if (quit) {
        return process.exit(0)
    }

    await application.init()
    await auth.init()
}
