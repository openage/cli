import * as request from '../helpers/request.js'
import * as input from '../helpers/input.js'
import * as template from '../helpers/template.js'
import logger from '../helpers/logger.js'
import * as file from '../helpers/file.js'

/**
 * Processes the pull operation by retrieving data from a remote source and managing local configurations.
 *
 * @param {Object} options - The options for the pull process.
 *  oa pull get://system/navs/home?application-code=docs system/navs/docs/home.json
 *  oa pull search://system/navs?application-code=docs system/navs/docs
 *  oa pull system/navs/docs
 *  oa pull folder://system/navs/docs
 *  oa pull system/navs/docs/home.json
 *  oa pull file://system/navs/docs/home.json
 */
export const execute = async (options) => {
    logger('handlers.pull').silly('execute')

    if (options.local) {

        if (typeof options.local === 'string') {
            options.local = file.parse(options.local)
        }
        logger('handlers.pull').silly('local', options.local)

        if (!options.remote) {
            const meta = file.meta('remote', options.local)
            if (meta) {
                options.remote = {
                    type: 'http',
                    config: meta
                }
            }
        }
    }

    if (options.remote) {
        if (typeof options.remote === 'string') {
            options.remote = input.parse(options.remote)
        }

        if (!options.local) {
            options.local = {
                type: 'file',
                config: {
                    file: '{{data.code}}.json',
                    folder: `$content/{{remote.config.service}}/{{remote.config.collection}}`,
                    format: 'json'
                }
            }
        }
    }

    // Get source and target if not supplied
    let source = options.remote || await input.get('remote', options)
    let target = options.local || await input.get('local', options)

    // Read data from the remote source
    let rawData = await request.read(source)

    // Ensure rawData is an array
    if (!Array.isArray(rawData)) {
        rawData = [rawData]
    }

    // Process each data item
    for (let data of rawData) {

        // Apply transformations to the data if specified
        if (options.transforms) {
            data = await request.transform(options.transforms, data)
        }

        // Ensure data is an array
        if (!Array.isArray(data)) {
            data = [data]
        }

        // Process each transformed data item
        for (let d of data) {
            let id = d.code || d.id

            // Generate the local path using the template
            let path = template.formatter(Object.assign({}, target)).inject({
                data: d,
                remote: source
            })

            const local = file.parse(path)

            const meta = {
                id: d.id || d.code,
                code: d.code,
                name: d.name || d.title,
                summary: d.summary || d.description,
                timestamp: new Date(),
                local: local,
                remote: {
                    service: source.config.service,
                    collection: source.config.collection,
                    query: source.config.query,
                    id: d.id || d.code
                }
            }

            // Write the data to the local path
            file.write(local, d)
            // await request.write(local, d);
            file.meta(id, local, meta)
        }
    }
}
