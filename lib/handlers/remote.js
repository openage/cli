import * as input from '../helpers/input.js'
import * as file from '../helpers/file.js'
import logger from '../helpers/logger.js'
import * as notifications from '../helpers/notifications.js'

export const execute = async (params) => {
    let log = logger('handlers.remote')
    log.silly('execute')

    if (params.local) {
        if (typeof params.local === 'string') {
            params.local = file.parse(params.local)
        }
        log.silly('local', params.local)
    }

    let local = params.local || await input.get('local', params)

    if (params.remote) {

        let data = file.read(local)

        let id = data.code || data.id
        const meta = {
            id: data.id || data.code,
            code: data.code,
            name: data.name || data.title,
            summary: data.summary || data.description,
            timestamp: data.timeStamp ? new Date(data.timeStamp) : new Date(),
            local: {
                file: `${id}.${local.format || 'json'}`
            },
            remote: {
                service: params.remote.config.service,
                collection: params.remote.config.collection,
                query: params.remote.config.query,
                id: data.id || data.code
            }
        }

        file.meta(id, local, meta)
    } else {
        params.remote = {
            type: 'http',
            config: file.meta('remote', local)
        }
    }

    notifications.data('remote', params.remote)

}
