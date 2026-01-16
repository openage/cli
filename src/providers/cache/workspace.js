import * as file from '../../helpers/file.js'

let store = {}

/**
 * Clears all key-value pairs in the store and removes the cache file.
 */
export const clear = () => {
    store = {}
    file.remove('$cache')
}

/**
 * Retrieves the value associated with the given key from the store.
 * If the key does not exist, it reads the value from the corresponding JSON file.
 *
 * @param {string} key - The key to retrieve the value for.
 * @returns {*} The value associated with the key, or null if not found.
 */
export const get = (key) => {
    if (store[key]) {
        return store[key]
    }

    store[key] = file.read({
        folder: '$cache',
        file: `${key}.json`
    })
    return store[key]
}

/**
 * Retrieves the key at the specified index in the storage.
 *
 * @param {number} index - The index of the key to retrieve.
 * @returns {string|null} The key at the specified index, or null if not found.
 */
export const key = (index) => {
    const keys = Object.keys(store)
    return keys.length > index ? keys[index] : null
}

/**
 * Removes the item associated with the given key from the store and deletes its cache file.
 *
 * @param {string} key - The key of the item to remove.
 */
export const remove = (key) => {
    delete store[key]
    file.remove({
        folder: '$cache',
        file: `${key}.json`
    })
}

/**
 * Adds a new key-value pair to the store, or updates the value if the key already exists.
 *
 * @param {string} key - The key to set the value for.
 * @param {*} value - The value to set.
 * @returns {*} The value that was set.
 */
export const set = (key, value) => {
    store[key] = value
    file.write({
        folder: '$cache',
        file: `${key}.json`
    }, value)
    return value
}
