import * as file from '../helpers/file.js'
import logger from '../helpers/logger.js'
import text from '../helpers/text.js'
import { paths } from '../../src/providers/context.js'
import { specs as _specs } from '../helpers/data.js'

export const discover = () => {

    let files = file.find({
        folder: '$specs'
    }, {
        exclude: {
            folders: [
                '.oa',
                '.logs',
                '.cache',
                'scripts'
            ]
        },
        include: {
            folders: [
                'specs'
            ],
            files: ['.json']
        }
    })

    logger('services.specs').verbose('count', files.length)

    const items = []

    for (const path of files) {

        // if (path.split(/[\\\/]/).includes('.cache')) {
        //     continue
        // }
        const json = file.read(path)

        let code = json.code
        if (!code) {
            code = path
                .replace(paths('$specs'), '')
                .replace('.json', '')
                .split(/[\\/]/) // Split by either backslash OR forward slash
                .filter(Boolean) // Remove empty strings from leading/trailing slashes
                .join('-')
                .toLowerCase()
        }

        const item = {
            code: code,
            name: text(json.name || code).toString('title'), // text(json.name ?? uri.path.split('/').join(' ')).toString('title')
            description: json.description,
            path: path,
            json: json
        }

        _specs.set(item.code, {
            code: item.code,
            name: item.name,
            path: path
        })

        items.push(item)
    }

    return items
}

export const get = (code) => {
    discover()
    const spec = _specs.get(code)
    if (!spec) {
        throw new Error('SPEC_DNE', {
            cause: {
                code
            }
        })
    }
    return file.read(spec.path)
}

export const status = (code, status) => {
    const spec = _specs.get(code)
    spec.status = status
    spec.timestamp = new Date()
    _specs.set(code, spec)
}
