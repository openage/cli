import logger from '../helpers/logger.js'
import * as context from '../services/context.js'
import application from '../services/application.js'
import * as auth from '../services/auth.js'

/**
 * Processes the login operation by initializing the application and authentication context.
 *
 * @param {Object} options - The options for the login process.
 */
export const execute = async (options) => {
    logger('handlers.login').silly('execute')
    context.clear()
    await application.init()
    await auth.init()
}
