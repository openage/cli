const context = require('../services/context')
const alert = require('../services/alert')
const crud = require('./crud')

exports.get = async (options, id) => {
    try {
        return crud(options.service, options.collection).get(id, context.toObject())
    } catch (err) {
        alert.error(`Getting ${options.service}/${options.collection}/${id}`, err)
        throw err
    }
}

exports.search = async (options, query) => {
    query = query || options.query || {}
    try {
        return crud(options.service, options.collection).search(query, context.toObject())
    } catch (err) {
        alert.error(`Searching ${options.service}/${options.collection}`, err)
        throw err
    }
}


exports.update = async (options, id, model) => {
    let operation
    try {
        operation = 'Checking'
        let existingId = await crud(options.service, options.collection).exists(id, context.toObject())

        if (existingId) {
            operation = 'Updating'
            return crud(options.service, options.collection).update(existingId, model, context.toObject())
        } else {
            operation = 'Creating'
            return crud(options.service, options.collection).create(model, context.toObject())
        }
    } catch (err) {
        alert.error(`${operation} ${options.service}/${options.collection}/${id}`, err)
    }
}


exports.create = async (options, model) => {
    try {
        return crud(options.service, options.collection).create(model, context.toObject())
    } catch (err) {
        alert.error(`Creating ${options.service}/${options.collection}`, err)
    }
}



