import * as service from '../helpers/service.js'

/**
 * Transforms the input data based on the provided configuration.
 * Retrieves data from a service based on the specified parameters.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} transformer - The configuration object containing service retrieval rules.
 * @returns {Promise<Object>} The retrieved data object from the service.
 */
export const transform = async (data, transformer) => {
    // if (transformer.get) {
    //     const params = transformer.params || transformer.get
    //     let getConfig = {}

    //     if (params && typeof params === 'string') {
    //         let parts = params.split('/')
    //         getConfig.service = parts[0]
    //         getConfig.collection = parts[1]
    //     } else {
    //         getConfig = params
    //     }
    //     // Retrieve data from the service using the configuration
    //     return await service.get(transformer.resource.config, data.id || data.code)
    // }
    return service.get(transformer.resource.config, data.id || data.code)
}
