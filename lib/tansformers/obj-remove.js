/**
 * Transforms the input data based on the provided configuration.
 * Removes specified properties from the data if the configuration indicates so.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} transformer - The configuration object containing transformation rules.
 * @returns {Promise<Object>} The transformed data object.
 */
export const transform = async (data, transformer) => {

    // Remove specified properties from the data
    transformer.resource.config.properties.forEach(key => {
        delete data[key]
    })

    return data
}
