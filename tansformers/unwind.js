const context = require('../services/context');
const logger = require('../helpers/logger');

/**
 * Retrieves the value from a nested object based on the specified key path.
 *
 * @param {Object} obj - The object to retrieve the value from.
 * @param {string|Array} key - The key path as a string or an array of keys.
 * @returns {*} The retrieved value or undefined if not found.
 */
const getValue = (obj, key) => {
    // Convert key to array if it's a string
    let keys = key;
    if (typeof keys === 'string') {
        keys = keys.split('.');
    }

    // Recursive function to traverse the object
    const get = (item) => {
        // Get the current key
        const current = keys.shift();

        // If we've reached the end of the key path, return the value
        if (!keys.length) {
            return item[current];
        }

        // Otherwise, recursively call get on the next level of the object
        return get(item[current]);
    };

    // Start the recursive traversal
    return get(obj);
};

/**
 * Transforms the input data by unwinding specified nested structures.
 *
 * @param {Object} data - The data object to transform.
 * @param {Object} config - The configuration object containing unwinding rules.
 * @returns {Array} The transformed output array.
 */
exports.transform = async (data, config) => {
    logger.silly('transformers/unwind:transform');

    // Initialize config defaults
    config.keys = config.keys || {};
    config.unwind = config.unwind || {};

    // Get the unwind path and root key from the config
    const unwindPath = config.unwind.path || 'children';
    const rootKey = config.unwind.root;

    // If a data key is specified, retrieve the data from the input object
    if (config.keys.data) {
        data = getValue(data, config.keys.data);
    }

    // Get the items to unwind from the data object
    let items = getValue(data, unwindPath);

    // If no items are found, return an empty array
    if (!data || !items) {
        return [];
    }

    // Ensure items is an array
    if (!Array.isArray(items)) {
        items = [items];
    }

    // Create a root object by cloning the data object and removing the unwind path
    const root = { ...data };
    delete root[unwindPath];

    // Unwind the items and create the output array
    const output = items.map(i => (rootKey
        ? {
            // If a root key is specified, add the root object to each item
            ...i,
            [rootKey]: root
        }
        : {
            // Otherwise, merge the root object into each item
            ...i,
            ...root
        }
    ));

    return output;
};
