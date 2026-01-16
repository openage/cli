import * as logProvider from '../../src/providers/logger.js'
import * as notification from '../../src/providers/notification.js'

const about = {
    root: 'OA CLI'
}

let logChannels = {}

function initLogger(name) {
    let logChannel = logProvider.getLogger(name)
    logChannels[name] = logChannel

    const errorLogger = logChannel.error

    logChannel.error = (message, ...args) => {
        notification.error(message)
        errorLogger(message, ...args)
    }

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
