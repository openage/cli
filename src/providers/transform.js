/**
 * Transforms the input data based on the specified transformation object.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} transformObj - The transformation object containing type and properties.
 * @returns {Promise<Object|string>} The transformed data or an error message if the transformation type is not defined.
 */
export const transform = async (data, transformObj) => {
    if (!transformObj.type) {
        return 'transform type not defined'
    }

    switch (transformObj.type) {
        case 'remove': {
            const propertyToRemove = transformObj.property
            const { [propertyToRemove]: removedProperty, ...dataRest } = data
            return dataRest
        }

        case 'add': {
            const propertyToModify = transformObj.property
            data[propertyToModify] = transformObj.valueToUpdate
            return data
        }

        default:
            return 'property to transform is not defined'
    }
}
