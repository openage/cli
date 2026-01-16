import * as constants from '../constants/index.js'
import * as file from './file.js'
import * as service from './service.js'

export const read = async (input) => {
    let type = input.type
    let config = input.config
    if (!type) {
        if (input.file) {
            type = 'file'
            config = input.file
        } else if (input.folder) {
            type = 'folder'
            config = input.folder
        } else if (input.http) {
            type = 'http'
            config = input.http
        }
    }

    switch (type) {
        case 'file':
        case 'folder':
            return file.read(config)

        case 'http':
        case 'https':
            return config.id ? service.get(config, config.id) : service.search(config)
    }
}

const _transform = async (transformer, data) => {

    if (typeof transformer === 'string') {
        const parts = transformer.split(':')
        transformer = constants.transforms.get(parts[0])
        transformer.config = transformer.config || {}
        if (parts.length > 1) {
            transformer.config.params = parts[1]
        }
    }

    // dynamic import of transformer handler
    let resourceType = transformer.resource.type
    if (resourceType === 'https') {
        resourceType = 'http'
    }
    const handlerModule = await import(`../tansformers/${resourceType}-${transformer.operation}.js`)
    const handler = handlerModule.default || handlerModule

    let items = []

    if (!Array.isArray(data)) {
        data = [data]
    }
    for (const d of data) {
        let item = await handler.transform(d, transformer)
        if (Array.isArray(item)) {
            items.push(...item)
        } else {
            items.push(item)
        }
    }

    return items
}

export const transform = async (transforms, data) => {
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

export const write = async (input, data) => {
    let type = input.type
    let config = input.config

    switch (type) {
        case 'file':
        case 'folder':
            return file.write(config, data)

        case 'create':
            return service.create(config, data)

        case 'http':
        case 'https':
        case 'update': {

            if (config.id) {
                return service.update(config, config.id, data)
            } else {
                return service.create(config, data)
            }
            // let id = input.config.id || data.id || data.code
        }
    }
}

// export const handler = async (options) => {
//     const data = await request.read(options.source)
//     data = request.transform(options.transforms, data)
//     await request.write(options.target, data)
// }
