let store = {}
let length = 0 // Initial length of store

/**
 * Clears all key-value pairs in the store and resets the length.
 */
export const clear = () => {
    store = {} // Initial store
    length = 0 // Reset length of store
}

/**
 * Retrieves the value associated with the given key.
 * Returns null if the key does not exist.
 *
 * @param {string} key - The key to retrieve the value for.
 * @returns {*} The value associated with the key, or null if not found.
 */
export const get = (key) => {
    return store[key] || null
}

/**
 * Retrieves the key at the specified index in the storage.
 *
 * @param {number} index - The index of the key to retrieve.
 * @returns {string|null} The key at the specified index, or null if not found.
 */
export const key = (index) => {
    const keys = Object.getOwnPropertyNames(store) // Get all keys in store

    // Return null if no keys are available or if the index is out of bounds
    if (!keys || !keys.length || index >= keys.length) {
        return null
    }

    // Return the key at the given index
    return keys[index]
}

/**
 * Removes the item associated with the given key.
 *
 * @param {string} key - The key of the item to remove.
 */
export const remove = (key) => {
    delete store[key] // Deletes the key from the store
}

/**
 * Adds a new key-value pair to the store, or updates the value if the key already exists.
 *
 * @param {string} key - The key to set the value for.
 * @param {*} value - The value to set.
 */
export const set = (key, value) => {
    store[key] = value // Sets the key to the specified value
}
