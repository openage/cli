import * as logProvider from '../../src/providers/logger.js'
import { settings } from '../helpers/data.js'

const about = {
    root: 'OA CLI'
}

let logChannels = {}

const setLevel = (logger, name) => {
    const parts = name.split('.')
    const results = []
    for (let i = parts.length; i > 0; i--) {
        results.push(parts.slice(0, i).join('.'))
    }

    let level = settings.get('logger.level') || 'info'
    for (const result of results) {
        const val = settings.get(`logger.${result}.level`)
        if (val) {
            level = val
            break
        }
    }
    logger.level(level)
}

function initLogger(name) {
    let logChannel = logProvider.getLogger(name)
    setLevel(logChannel, name)
    logChannels[name] = logChannel

    return logChannel
}

export default (name) => {
    if (!name) {
        name = about.root
    }
    let logChannel = logChannels[name]
    if (logChannel) {
        return logChannel
    }

    return initLogger(name)
}
