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

    let remoteName = 'origin'
    if (typeof options.remote === 'string') {
        remoteName = options.remote
        options.remote = null
    } else if (options.remote && options.remote.resource) {
        options.remote = options.remote.resource
    }

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
        let target = options.remote

        if (!target) {
            let remotes = file.meta('remotes', source)
            if (!remotes || Object.keys(remotes).length === 0) {
                const oldRemote = file.meta('remote', source)
                if (oldRemote) {
                    remotes = { origin: oldRemote }
                }
            }
            if (remotes && remotes[remoteName]) {
                target = {
                    type: 'http',
                    config: remotes[remoteName]
                }
            }
        }

        if (!target) {
            log.error(`Remote configuration for '${remoteName}' not found for ${source}`)
            continue
        }

        log.silly('target', target)

        let data = file.read(source)

        let d = await request.write(target, data)

        let id = d.code || d.id

        let existingMeta = file.meta(id, source) || {}
        let remotes = existingMeta.remotes || {}
        if (Object.keys(remotes).length === 0 && existingMeta.remote) {
            remotes = { origin: existingMeta.remote }
        }

        remotes[remoteName] = {
            service: target.config.service,
            collection: target.config.collection,
            query: target.config.query,
            id: d.id || d.code
        }

        const meta = {
            id: d.id || d.code,
            code: d.code,
            name: d.name || d.title,
            summary: d.summary || d.description,
            timestamp: d.timeStamp ? new Date(d.timeStamp) : new Date(),
            local: {
                file: `${id}.${local.format || 'json'}`
            },
            remotes: remotes
        }

        file.meta(id, source, meta)
    }
}
