const request = require('../helpers/request');
const input = require('../helpers/input');
const file = require('../helpers/file');
const logger = require('../helpers/logger');

/**
 * Processes the push operation by sending data to a remote source and managing local configurations.
 *
 * @param {Object} options - The options for the push process.
 */
exports.process = async (options) => {
    logger.silly('handlers/push', 'process');

    const paramCount = options?._?.length;

    // Check if local option is provided and set it if necessary
    if (paramCount > 1) {
        const param1 = input.parse(options._[1]);
        // support for commands like
        // oa push directory/rolesTypes/admin.json 
        // oa push file://directory/rolesTypes/admin.json 
        // oa push directory/rolesTypes 
        // oa push folder://directory/rolesTypes 

        if (typeof param1 === 'string') {
            // oa push system/navs/docs # by target
            // oa push system/navs/docs/home.json # by target
            options.local = param1;
        } else {
            switch (param1.type) {
                case 'file':
                case 'folder':
                    options.local = param1;
                    break

                case 'create':
                case 'update':
                    options.remote = param1;
                    break;
            }
        }

        if (paramCount > 2) {
            const param2 = input.parse(options._[2]);

            if (options.local && !options.remote) {
                // oa push system/navs/docs/home.json update://system/navs/home?application-code=docs 
                // oa push system/navs/docs create://system/navs?application-code=docs 
                options.remote = param2;
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
    }

    let local = options.local || await input.get('local', options);


    // Get files to process based on local configuration
    let files = file.get(local.config, {
        exclude: {
            folders: [
                '.oa',
                '.cache',
                '.logs',
                '.settings',
                '.scripts'
            ]
        },
        include: { files: ['.json'] }
    })

    // Process each file and send data to remote source
    for (const item of files) {
        const source = {
            file: item,
            folder: local.config.folder,
            format: local.config.format
        };
        let target = options.remote || {
            type: 'update',
            config: file.meta('remote', source)
        }

        let data = file.read(source);

        let d = await request.write(target, data);

        let id = d.code || d.id
        const meta = {
            id: d.id || d.code,
            code: d.code,
            name: d.name || d.title,
            summary: d.summary || d.description,
            timestamp: new Date(),
            local: {
                file: `${id}.${local.format || 'json'}`
            },
            remote: {
                service: target.config.service,
                collection: target.config.collection,
                query: target.config.query,
                id: d.id || d.code
            }
        };

        file.meta(id, source, meta)
    }
}