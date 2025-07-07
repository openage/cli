const request = require('../helpers/request');
const input = require('../helpers/input');
const file = require('../helpers/file');
const alert = require('../services/alert');
const constant = require('../services/constant');
const logger = require('../helpers/logger');

/**
 * Processes the script operation by managing file input and execution.
 *
 * @param {Object} options - The options for the script process.
 */
exports.process = async (options) => {
    logger.silly('handlers/script', 'process');

    if (typeof options === 'string') {
        let scriptFile = options

        if (!scriptFile.toLowerCase().endsWith('.json')) {
            scriptFile = `${scriptFile}.json`
        }

        if (!file.exists(scriptFile)) {
            scriptFile = `$scripts/${scriptFile}`
        }

        if (file.exists(scriptFile)) {
            options = {
                file: scriptFile
            }
        }
    }

    // Check if file option is provided and set it if necessary
    if (options?._?.length > 1 && !options.file) {
        options.file = options._[1];
    }

    let fileOptions = {};
    // let fileOptions = {
    //     folder: await input.get('folder', options),
    //     file: await input.get('file', options)
    // }

    if (options.file) {
        fileOptions.file = options.file
    } else {
        fileOptions.file = await input.get('file', options)
    }

    let commands = await file.read(fileOptions)

    if (commands.items) {
        commands = commands.items
    }

    if (!Array.isArray(commands)) {
        commands = [commands]
    }

    // Filter out disabled commands
    commands = commands.filter(c => !c.disabled)

    let count = 0;
    let progress = alert.progress().start(commands.length * 2, 'Processing commands')

    // Process each command
    for (let command of commands) {
        progress.update(++count, `Started: ${command.name || command.code}`)
        const action = constant.actions.get(command.type);
        if (!action) {
            return alert.error('ACTION_NF', command.type);
        }
        // Load the corresponding handler dynamically
        let handler;
        try {
            handler = require(`../handlers/${action.handler}`);
        } catch (err) {
            return alert.error('HANDLER_NF', action.handler);
        }

        await handler.process({ ...command.config, ...options })
        progress.update(++count, `Complete: ${command.name || command.code}`)
    }

    progress.end(`Processed '${commands.length} command(s)`)
}