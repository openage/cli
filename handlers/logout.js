const application = require('../services/application');
const context = require('../services/context');
const auth = require('../services/auth');
const input = require('../helpers/input');
const logger = require('../helpers/logger');

/**
 * Processes the logout operation by clearing the context and initializing the application and authentication.
 *
 * @param {Object} options - The options for the logout process.
 */
exports.process = async (options) => {
    logger.silly('handlers/logout', 'process')

    context.clear();
    let quit = await input.get('quit');
    if (quit) {
        return process.exit(0);
    }

    await application.init();
    await auth.init();
}