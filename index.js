#!/usr/bin/env node
process.env.NODE_NO_WARNINGS = '1'
process.env.OA_CWD = process.env.OA_CWD || process.cwd()

const getArg = (name) => {
    const prefix = `--${name}=`
    const arg = process.argv.find(a => a.startsWith(prefix))
    return arg ? arg.replace(prefix, '') : null
}
const env = getArg('env')
if (env && !process.env.NODE_ENV) {
    process.env.NODE_ENV = env
}

import * as command from './src/services/command.js'
import * as constant from './lib/constants/index.js'
import { settings } from './lib/helpers/data.js'
import * as context from './lib/services/context.js'
import application from './lib/services/application.js'
import * as notifications from './lib/helpers/notifications.js'
import * as auth from './lib/services/auth.js'
import * as input from './lib/helpers/input.js'
import logger from './lib/helpers/logger.js'

settings.getOrSet('logger.level', 'fatal')
let log = logger('root')
process.env.NODE_ENV = process.env.NODE_ENV || context.env()

/**
 * Main application loop that handles command execution
 * Prompts for user input in interactive mode or runs default action
 * Continues running until application is terminated
 */
const _run = async () => {
    let cmd
    // If in interactive mode, prompt user for command
    if (settings.get('ux.interactive')) {
        cmd = await input.get('cmd')
    } else {
        // Otherwise use default 'run' action
        cmd = constant.actions.get('run')
    }
    // Execute the command and continue the loop
    try {
        await command.execute(cmd)
    } catch (e) {
        settings.set('ux.interactive', true)
        log.error(e)
    }
    await _run()
}

const init = async () => {
    log.debug('Getting Config')
    await application.init()
    if (settings.get('ux.interactive')) {
        context.show()
    }

    log.debug('Logging in')
    await auth.init()
    let cmd = command.get()
    if (cmd) {
        let action = constant.actions.get(cmd)
        if (action) {
            log.debug('Running', action.code)
            try {
                await command.run()
            } catch (e) {
                log.error(e)
                // notifications.error('CMD_RUN_UNKNOWN_ERROR')
                // console.log(log.logFile())
            }
        } else {
            await command.execute(constant.actions.get('script'), { _: ['script', cmd] })
        }
    } else {
        settings.set('ux.interactive', true)
        await _run()
    }
}

init()
