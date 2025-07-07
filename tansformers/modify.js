const _ = require('lodash');

/**
 * Transforms the input data based on the provided configuration.
 * Removes specified keys from the data if the configuration indicates so.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} config - The configuration object containing transformation rules.
 * @returns {Object} The transformed data object.
 */
exports.transform = async (data, config) => {
    if (config.remove) {
        let keys;
        if (config.params) {
            if (typeof config.params === 'string') {
                keys = config.params.split(',');
            } else {
                keys = config.params;
            }
        } else {
            keys = config.remove;
        }
        // Remove specified keys from the data
        keys.forEach(key => {
            delete data[key];
        });
    }
    return data;
};
