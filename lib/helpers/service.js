import * as context from '../services/context.js'
import * as notifications from './notifications.js'
import remote from './remote.js'

export const get = async (options, id) => {
    try {
        return remote(options.service, options.collection).get(id, context.toObject())
    } catch (err) {
        notifications.error(new Error(`Getting ${options.service}/${options.collection}/${id}`, {
            cause: err
        }))
        throw err
    }
}

export const search = async (options, query) => {
    query = query || options.query || {}
    try {
        return remote(options.service, options.collection).search(query, context.toObject())
    } catch (err) {
        notifications.error(new Error(`Searching ${options.service}/${options.collection}`, {
            cause: err
        }))
        throw err
    }
}

export const update = async (options, id, model) => {
    let operation
    try {
        operation = 'Checking'
        let existingId = await remote(options.service, options.collection).exists(id, context.toObject())

        if (existingId) {
            operation = 'Updating'
            return remote(options.service, options.collection).update(existingId, model, context.toObject())
        } else {
            operation = 'Creating'
            return remote(options.service, options.collection).create(model, context.toObject())
        }
    } catch (err) {
        notifications.error(new Error(`${operation} ${options.service}/${options.collection}/${id}`, {
            cause: err
        }))
    }
}

export const create = async (options, model) => {
    try {
        return remote(options.service, options.collection).create(model, context.toObject())
    } catch (err) {
        notifications.error(new Error(`Creating ${options.service}/${options.collection}`, {
            cause: err
        }))
    }
}
