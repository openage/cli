import fs from 'fs'
import path from 'path'
import logger from '../helpers/logger.js'
import * as notifications from '../helpers/notifications.js'
import { validateContent } from '../helpers/schema-validation.js'

export const execute = async (params) => {
    const log = logger('handlers.validate')
    let inputPath = params.file || params.local
    if (inputPath && typeof inputPath === 'object') inputPath = inputPath.path || inputPath.file || inputPath.folder
    if (!inputPath) return console.error('\x1b[31mNo file path provided for validation.\x1b[0m')
    const target = path.resolve(process.env.OA_CWD || process.cwd(), inputPath)
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return console.error(`\x1b[31mFile not found: ${inputPath}\x1b[0m`)
    const result = await validateContent(target, fs.readFileSync(target, 'utf8'))
    notifications.message(`\n Validating: ${inputPath} `, 'info-highlighted')
    if (result.schema) notifications.message(` Schema: ${result.schemaFile} `, 'info')
    if (result.valid) {
        notifications.message('✔  Passed: 1', 'success')
        notifications.message('✖  Failed: 0', 'error')
        notifications.data('Result', { headers: ['Result', 'Property', 'Message'], rows: [[' ✔ PASS ', '(root)', 'File matches schema']] }, { view: 'tabular' })
        return
    }
    log.warn('validation failed', result)
    notifications.message('✔  Passed: 0', 'success')
    notifications.message(`✖  Failed: ${result.errors.length}`, 'error')
    notifications.data('Result', {
        headers: ['Result', 'Property', 'Message'],
        rows: result.errors.map((message) => [' ✖ FAIL ', '(root)', message])
    }, { view: 'tabular' })
}
