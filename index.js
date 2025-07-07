#!/usr/bin/env node
process.env.NODE_NO_WARNINGS = 1
const path = require('path')
process.env.NODE_CONFIG_DIR = path.join(__dirname, './config')

require('./initialize/handlers')
require('./initialize/transformers')
require('./initialize/providers')

const command = require('./services/command');
const constant = require('./services/constant');
const context = require('./services/context');
const application = require('./services/application');
const alert = require('./services/alert');
const auth = require('./services/auth');
const input = require('./helpers/input');
const logger = require('./helpers/logger');

logger.level('fatal');

/**
 * Main application loop that handles command execution
 * Prompts for user input in interactive mode or runs default action
 * Continues running until application is terminated
 */
const _run = async () => {
    let cmd
    // If in interactive mode, prompt user for command
    if (context.interactive()) {
        cmd = await input.get('cmd');
    } else {
        // Otherwise use default 'run' action
        cmd = constant.actions.get('run')
    }
    // Execute the command and continue the loop
    await runCmd(cmd)
    await _run();
}

const runCmd = async (cmd, params) => {
    logger.debug('Running', cmd.title)
    try {
        let result = await require(`./handlers/${cmd.handler}`).process(params || {})
        alert.success(cmd.title, result || 'Done')
    } catch (e) {
        context.interactive(true)
        logger.error(e)
        alert.error(cmd.title, 'Something went wrong')
    }
}

const init = async () => {
    logger.debug('Booting', 'Getting Config')
    process.env.OA_CWD = await input.get('cwd', {})
    await application.init();
    logger.debug('Booting', 'Logging in')
    await auth.init();
    let cmd = command.get()
    if (cmd) {
        let action = constant.actions.get(cmd);
        if (action) {
            logger.debug('Running', action.code)
            try {
                await command.run();
            } catch (e) {
                logger.error(e)
                alert.error(`CMD_RUN_${e.message}`, { action: action.code, error: e })
            }
        } else {
            await runCmd(constant.actions.get('script'), cmd)
        }
    } else {
        context.interactive(false)
        await _run();
    }
}

init();
