const constant = require('../services/constant');
const file = require('./file');
const service = require('./service');
const path = require('path');


/**
    {
        "type": "search",
        "config": {
            "service": "welcome",
            "collection": "attendances"
        }
    }

    {
        "type": "file",
        "config": {
            "path": ":temp/attendances.json"
        }
    }

    {
        "type": "create",
        "config": {
            "service": "composer",
            "collection": "tasks"
        }
    }
 */

exports.read = async (input) => {
    /* eslint-disable */
    switch (input.type) {
        case 'file':
        case 'folder':
            return file.read(input.config)

        case 'get':
            return service.get(input.config, input.config.id)

        case 'search':
            return service.search(input.config)
    }
    /* eslint-enable */
}


const _transform = async (transformer, data) => {

    if (typeof transformer === 'string') {
        const parts = transformer.split(':')
        transformer = constant.transforms.get(parts[0])
        transformer.config = transformer.config || {};
        if (parts.length > 1) {
            transformer.config.params = parts[1];
        }
    }


    let handler = require(`../tansformers/${transformer.type}`)

    let items = []

    if (!Array.isArray(data)) {
        data = [data]
    }
    for (const d of data) {
        let item = await handler.transform(d, transformer.config)
        if (Array.isArray(item)) {
            items.push(...item)
        } else {
            items.push(item)
        }
    }

    return items;

}

exports.transform = async (transforms, data) => {
    if (typeof transforms === 'string' && transforms.indexOf('|') !== -1) {
        transforms = transforms.split('|').filter(i => i !== '')
    }
    if (!Array.isArray(transforms)) {
        transforms = [transforms]
    }

    for (let transformer of transforms) {
        data = await _transform(transformer, data)
    }

    return data
}


exports.write = async (input, data) => {
    /* eslint-disable */
    switch (input.type) {
        case 'file':
        case 'folder':
            return file.write(input.config, data);

        case 'create':
            return service.create(input.config, data)

        case 'update':
            let id = input.config.id || data.id || data.code
            return service.update(input.config, id, data)

    }
    /* eslint-enable */
}


exports.handler = async (options) => {
    const data = await request.read(options.source)
    data = request.transform(options.transforms, data)
    await request.write(options.target, data)
}