const context = require('../services/context');
const input = require('../helpers/input');
const logger = require('../helpers/logger');

/**
 * Processes the quit operation by clearing the context and exiting the application.
 *
 * @param {Object} options - The options for the quit process.
 */
exports.process = async (options) => {
    logger.silly('handlers/quit', 'process');

    let clean = await input.get('clean');
    if (clean) {
        context.clear();
    }
    return process.exit(0);
};