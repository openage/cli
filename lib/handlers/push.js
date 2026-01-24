import * as request from '../helpers/request.js'
import * as input from '../helpers/input.js'
import * as file from '../helpers/file.js'
import logger from '../helpers/logger.js'

/**
 * Processes the push operation by sending data to a remote source and managing local configurations.
 *
 * @param {Object} options - The options for the push process.
 * oa push directory/rolesTypes/admin.json 
 * oa push file://directory/rolesTypes/admin.json 
 * oa push directory/rolesTypes 
 * oa push folder://directory/rolesTypes 
 * oa push system/navs/docs # by target
 * oa push system/navs/docs/home.json # by target
 * oa push system/navs/docs/home.json update://system/navs/home?application-code=docs 
 * oa push system/navs/docs create://system/navs?application-code=docs 
 */
export const execute = async (options) => {
    let log = logger('handlers.push')
    log.silly('execute')

    if (options.local) {
        if (typeof options.local === 'string') {
            options.local = file.parse(options.local)
        }
        log.silly('local', options.local)
    }

    let local = options.local || await input.get('local', options)

    // Get files to process based on local configuration
    let files = file.find(local, {
        exclude: {
            folders: [
                '.oa',
                '.logs',
                'scripts'
            ]
        },
        include: {
            folders: [
                'content'
            ],
            files: ['.json']
        }
    })

    // Process each file and send data to remote source
    for (const source of files) {
        let target = options.remote || {
            type: 'http',
            config: file.meta('remote', source)
        }

        log.silly('target', target)

        let data = file.read(source)

        let d = await request.write(target, data)

        let id = d.code || d.id
        const meta = {
            id: d.id || d.code,
            code: d.code,
            name: d.name || d.title,
            summary: d.summary || d.description,
            timestamp: d.timeStamp ? new Date(d.timeStamp) : new Date(),
            local: {
                file: `${id}.${local.format || 'json'}`
            },
            remote: {
                service: target.config.service,
                collection: target.config.collection,
                query: target.config.query,
                id: d.id || d.code
            }
        }

        file.meta(id, source, meta)
    }
}
