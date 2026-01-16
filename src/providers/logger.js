// const vscode = require('vscode')
// const chalk = require('chalk')

import { createLogger, format, transports } from 'winston'
const { combine, colorize, simple, timestamp, printf } = format

const cliFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`
})

export const getLogger = (name) => {
    const logger = createLogger({
        level: 'info', // Default log level (can be overridden by transports)
        // Use a different format for CLI output
        format: combine(
            colorize(), // Colorize the output based on the log level
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a timestamp
            // You can use 'simple()' for a basic level: message format
            // or the custom 'cliFormat' for more control
            cliFormat
        ),
        transports: [
            new transports.Console(), // Output logs to the console
        ],
        exitOnError: false, // Prevents the process from exiting on handled exceptions
    })
    return {
        fatal: (message, ...args) => { logger.error(message, args) },
        error: (message, ...args) => { logger.error(message, args) },
        warn: (message, ...args) => { logger.warn(message, args) },
        info: (message, ...args) => { logger.info(message, args) },
        verbose: (message, ...args) => { logger.verbose(message, args) },
        debug: (message, ...args) => { logger.debug(message, args) },
        silly: (message, ...args) => { logger.silly(message, args) }
    }

}

// const formatError = (error) => {
//     // Extract first line of stack trace for file/line info
//     const stackLines = error.stack ? error.stack.split('\n') : []
//     const locationMatch = stackLines[1]?.match(/\((.*)\)/) || stackLines[1]?.match(/at (.*)/)
//     const location = locationMatch ? locationMatch[1] : 'N/A'

//     return [
//         `🚨 Error: ${error.name || 'Error'}`,
//         `Message : ${error.message || 'No message provided'}`,
//         `File    : ${location}`,
//         `Stack   :`,
//         ...stackLines.slice(1).map(line => '  ' + line.trim())
//     ].join('\n')
// }

// case 'fatal':
//     icon = '☠️'
//     break
// case 'error':
//     icon = '🚨'
//     break
// case 'warning':
//     break
// default:
//     icon = '✖'
// case 'warn':
//     icon = '⚠️'
