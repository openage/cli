const service = require('../helpers/service');

/**
 * Transforms the input data based on the provided configuration.
 * Retrieves data from a service based on the specified parameters.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} config - The configuration object containing service retrieval rules.
 * @returns {Promise<Object>} The retrieved data object from the service.
 */
exports.transform = async (data, config) => {
    if (config.get) {
        let getConfig = {};

        if (config.params) {
            if (typeof config.params === 'string') {
                let parts = config.params.split('/');
                getConfig.service = parts[0];
                getConfig.collection = parts[1];
            } else {
                getConfig = config.params;
            }
        }
        // Retrieve data from the service using the configuration
        return await service.get(getConfig, data.id || data.code);
    }
    return data;
};