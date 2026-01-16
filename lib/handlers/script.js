import * as input from '../helpers/input.js'
import * as file from '../helpers/file.js'
import * as notifications from '../helpers/notifications.js'
import * as constants from '../constants/index.js'
import logger from '../helpers/logger.js'

/**
 * Processes the script operation by managing file input and execution.
 *
 * @param {Object} options - The options for the script process.
 * oa bulk
 * oa bulk.json
 */
export const execute = async (options) => {
    logger('handlers.script').verbose('execute')

    if (typeof options.file === 'string') {
        let scriptFile = options.file
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
    } else {
        options.file = await input.get('file', options)
    }

    let commands = await file.read(options.file)

    if (commands.items) {
        commands = commands.items
    }

    if (!Array.isArray(commands)) {
        commands = [commands]
    }

    // Filter out disabled commands
    commands = commands.filter(c => !c.disabled)

    let count = 0
    let progress = notifications.progress('Processing Commands', commands.length)

    // Process each command
    for (let command of commands) {
        progress.message = `Command: ${command.name || command.code}`
        const action = constants.actions.get(command.type)
        if (!action) {
            return notifications.error(new Error('ACTION_NF', { cause: { action: command.type } }))
        }
        // Load the corresponding handler dynamically
        let handler
        try {
            handler = await import(`../handlers/${action.handler}.js`)
        } catch (err) {
            return notifications.error(new Error('HANDLER_NF', { cause: { handler: action.handler } }))
        }

        await handler.execute(command.config)
        progress.complete = ++count
        progress.render()
    }

    progress.isComplete = true
}


export const parse = (args) => {
    if (typeof args === 'string') {
        return {
            file: args
        }
    }
    const paramCount = args.length
    const params = {}

    // Check if local option is provided and set it if necessary
    if (paramCount > 0) {
        const param1 = input.parse(args[0])

        // commands suppported
        if (typeof param1 === 'string') {
            // oa script scripts/bulk.json
            // oa script bulk.json
            params.file = param1
        }
    }

    return params
}
