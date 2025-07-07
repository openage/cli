const constant = require('../services/constant');
const context = require('../services/context');
const alert = require('../services/alert');
const input = require('../helpers/input');
const logger = require('../helpers/logger');

/**
 * Parses input from the request based on the configuration fields provided.
 *
 * @param {string} req - The request string to parse.
 * @param {Array<Object>} configFields - The configuration fields to extract from the request.
 * @returns {Object} The parsed key-value pairs from the request.
 */
const parseInput = (req, configFields) => {
    configFields = configFields || [];

    // Extract only the configured keys from parsedParams
    const result = {};
    for (const field of configFields) {
        const regex = new RegExp(`(--${field.key}|-${field.code})\\s+("[^"]+"|[^\\s]+)`);
        const match = req.match(regex);

        if (match) {
            // Remove surrounding quotes if present
            const value = match[2].replace(/^"|"$/g, '');
            result[field.key] = value;
        }
    }

    logger.debug('Parsed parameters:', result); // Debugging output

    return result;
}

/**
 * Processes the input and executes the corresponding handler.
 *
 * @param {Object} options - The options for the process.
 * @returns {Promise<void>}
 */
exports.process = async (options) => {
    logger.silly('handlers/run', 'process')

    let inputString = await input.get('run', options)
    if (!inputString || 'SHOW|INTERACTIVE|MORE'.indexOf(inputString.toUpperCase()) !== -1) {
        context.interactive(true)
        return
    } else {
        context.interactive(false)
    }
    const [actionCode, ...argsArray] = inputString.split(' ');

    const action = constant.actions.get(actionCode);
    if (!action) {
        return alert.error('ACTION_NF', actionCode);
    }
    // Load the corresponding handler dynamically
    let handler;
    try {
        handler = require(`../handlers/${action.handler}`);
    } catch (err) {
        return alert.error('HANDLER_NF', action.handler);
    }

    action.config = action.config || {}

    let params = parseInput(inputString, action.config.fields)
    await handler.process(params)
}
