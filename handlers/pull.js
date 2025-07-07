const request = require('../helpers/request');
const input = require('../helpers/input');
const template = require('../helpers/template');
const logger = require('../helpers/logger');
const file = require('../helpers/file');
const { option } = require('yargs');

/**
 * Processes the pull operation by retrieving data from a remote source and managing local configurations.
 *
 * @param {Object} options - The options for the pull process.
 */
exports.process = async (options) => {
    logger.silly('handlers/pull', 'process');

    const paramCount = options?._?.length;

    // Check if local option is provided and set it if necessary
    if (paramCount > 1) {
        const param1 = input.parse(options._[1]);

        // commands suppported
        if (typeof param1 === 'string') {
            // oa pull system/navs/docs # by target
            // oa pull system/navs/docs/home.json # by target
            options.local = param1;
        } else {
            switch (param1.type) {
                case 'file':
                // oa pull file://system/navs/docs/admin.json # by target
                case 'folder':
                    // oa pull folder://system/navs/docs # by target
                    options.local = param1;
                    break

                case 'get':
                // oa pull get://system/navs/home?application-code=docs 
                case 'search':
                    // oa pull search://system/navs?application-code=docs 
                    options.remote = param1;
                    break;
            }
        }
        if (paramCount > 2) {
            const param2 = input.parse(options._[2]);

            if (options.remote && !options.local) {
                // oa pull get://system/navs/home?application-code=docs system/navs/docs/home.json
                // oa pull search://system/navs?application-code=docs system/navs/docs
                options.local = param2;
            }
        }
    }

    if (options.local) {

        if (typeof options.local === 'string') {
            if (options.local.indexOf('://') === -1) {
                options.local = options.local.endsWith('.json')
                    ? `file://${options.local}`
                    : `folder://${options.local}`
            }
            options.local = input.parse(options.local)
        }
        logger.silly('handlers/push:local', options.local);

        if (!options.remote) {
            const meta = file.meta('remote', options.local.config)
            if (meta) {
                options.remote = {
                    type: meta.id ? 'get' : 'search',
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
                type: options.remote.type === 'get' ? 'file' : 'folder',
                config: {
                    file: options.remote.type === 'get' ? `${options.remote.config.id}.json` : undefined,
                    folder: `${options.remote.config.service}/${options.remote.config.collection}`,
                    format: 'json'
                }
            }
        }
    }

    // Get source and target if not supplied
    let source = options.remote || await input.get('remote', options);
    let target = options.local || await input.get('local', options);

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

            const meta = {
                id: d.id || d.code,
                code: d.code,
                name: d.name || d.title,
                summary: d.summary || d.description,
                timestamp: new Date(),
                local: {
                    file: `${id}.${path.format || 'json'}`
                },
                remote: {
                    service: source.config.service,
                    collection: source.config.collection,
                    query: source.config.query,
                    id: d.id || d.code
                }
            };

            // Write the data to the local path
            await request.write(path, d);
            file.meta(id, path.config, meta)
        }
    }
}