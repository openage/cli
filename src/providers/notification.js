import chalk from 'chalk'
import figlet from 'figlet'
import clear from 'clear'
import Table from 'cli-table3'
import * as pathModule from 'path'
import readline from 'readline'

const isPath = (val) => {
    if (typeof val !== 'string') return false

    const ext = pathModule.extname(val)
    const hasSlash = val.includes('/') || val.includes('\\')

    return ext || hasSlash
}

const coloredValue = (value) => {
    const type = typeof value

    if (value === null) {
        return chalk.gray('[NULL]')
    }

    if (value === '******') {
        return chalk.gray('[REDACTED]')
    }

    if (Array.isArray(value)) {
        return chalk.magenta(`[Array(${value.length})]`)
    }

    if (isPath(value)) {
        return chalk.blue(value)
    }

    switch (type) {
        case 'string':
            return chalk.green(`"${value}"`)

        case 'number':
            return chalk.cyan(value)

        case 'boolean':
            return value ? chalk.yellow('true') : chalk.yellow('false')

        case 'object':
            return chalk.magenta('[Object]')

        case 'function':
            return chalk.red('[Function]')

        case 'undefined':
            return chalk.gray('Not Set')

        default:
            return chalk.white(value)
    }
}

const _timestamp = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const flattenObject = (obj, parentKey = '', result = {}) => {
    for (const [key, value] of Object.entries(obj)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            flattenObject(value, newKey, result)
        } else {
            result[newKey] = value
        }
    }
    return result
}

const render = {
    'success': (v) => chalk.green(v),
    'success-bold': (v) => chalk.green.bold(v),
    'success-highlighted': (v) => chalk.bgGreen.black(v),
    'warn': (v) => chalk.yellow(v),
    'warn-bold': (v) => chalk.yellow.bold(v),
    'warn-highlighted': (v) => chalk.bgYellow.black(v),
    'info': (v) => chalk.blue(v),
    'info-bold': (v) => chalk.blue.bold(v),
    'info-highlighted': (v) => chalk.bgBlue.white(v),
    'error': (v) => chalk.red(v),
    'error-bold': (v) => chalk.red.bold(v),
    'error-highlighted': (v) => chalk.bgRed.white(v),
    'default': (v) => chalk.white(v),
    'default-bold': (v) => chalk.white.bold(v),
    'default-highlighted': (v) => chalk.bgGrey.white(v),
    banner: (v) => chalk.yellow(figlet.textSync(v, { horizontalLayout: 'full' }))
}

export const data = (key, value, styles) => {
    styles = styles || {}
    styles.view = styles.view || 'key-val'

    switch (styles.view) {
        case 'key-val':
            keyVal(key, value, styles)
            break
        case 'tabular':
            tabular(key, value, styles)
            break
    }
}

const keyVal = (key, value, styles) => {
    if (value !== null && typeof value === 'object') {
        value = flattenObject(value)

        for (const k in value) {
            console.log(
                chalk.bold.yellow(`${key ? key + '.' : ''}${k}:`),
                coloredValue(value[k])
            )
        }
    } else {
        console.log(
            chalk.bold.yellow(`${key}:`),
            coloredValue(value)
        )
    }
}

const tabular = (title, data, styles) => {

    console.log(chalk.bold.yellow(`\n${title}`))
    styles = styles || {}

    styles.head = styles.head || ['cyan']
    styles.border = styles.border || []
    styles.conditions = styles.conditions || {}

    const table = new Table({
        head: data.headers.map(d => chalk.bold(d)),
        style: { head: styles.head, border: styles.border },
    })

    data.rows.forEach(r => {
        const row = []
        for (let index = 0; index < r.length; index++) {
            const value = r[index];
            const conditions = styles.conditions[`${index}`]

            if (conditions) {
                const condition = conditions.find(c => c.value === value)
                row.push(render[condition.style](value))
            } else {
                row.push(value)
            }
        }

        table.push(row)
    });
    console.log(table.toString())
}

export const message = (message, style) => {
    style = style || 'default'
    console.log(render[style](message))
}

export const error = (error) => {
    console.error(
        chalk.bgRed.white.bold('🚨  Error: '),
        chalk.red(error?.message)
    )
}

export const dialog = (title, message, actions) => {
    clear()
    console.log(
        chalk.bgYellow.black.bold(title),
        chalk.yellow(message)
    )

}

export const progress = (title, total) => {
    const summary = {
        complete: 0,
        total: total || 1,
        message: '',
        startTime: Date.now(),
        isComplete: false
    }

    const getElapsedTime = () => {
        const elapsedMs = Date.now() - summary.startTime
        const elapsedSeconds = Math.floor(elapsedMs / 1000)

        if (elapsedSeconds < 60) {
            return `${elapsedSeconds}s`
        } else if (elapsedSeconds < 3600) {
            const minutes = Math.floor(elapsedSeconds / 60)
            const seconds = elapsedSeconds % 60
            return `${minutes}m ${seconds}s`
        } else {
            const hours = Math.floor(elapsedSeconds / 3600)
            const minutes = Math.floor((elapsedSeconds % 3600) / 60)
            const seconds = elapsedSeconds % 60
            return `${hours}h ${minutes}m ${seconds}s`
        }
    }

    // Display the current progress (can be customized)
    const display = () => {

        const percentage = summary.total ? (summary.complete / summary.total) * 100 : 0

        const barWidth = 30 // Total width of the progress bar
        const filledBarLength = Math.round(barWidth * (percentage / 100))

        const filledBar = '█'.repeat(filledBarLength) // Filled portion
        const emptyBar = '░'.repeat(barWidth - filledBarLength) // Empty portion

        // Clear the line and update with the new progress
        readline.cursorTo(process.stdout, 0)
        process.stdout.write(`${title} ${chalk.blue(filledBar)}${chalk.gray(emptyBar)} [${getElapsedTime()}] ${summary.message} `)
    }

    if (!summary.isComplete) {
        setTimeout(display, 100)
    }

    summary.render = display

    return summary
}
