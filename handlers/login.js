const logger = require('../helpers/logger');
const context = require('../services/context');

/**
 * Processes the login operation by initializing the application and authentication context.
 *
 * @param {Object} options - The options for the login process.
 */
exports.process = async (options) => {
    logger.silly('handlers/login', 'process');
    context.clean();
    await application.init();
    await auth.init();
};