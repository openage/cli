const file = require('../helpers/file');

let settings = {
    folder: '$settings',
    file: 'preferences.json'
};

let store = {};

/**
 * Initializes the preferences store by reading from the settings file.
 */
const _init = () => {
    store = file.read(settings);

    if (!store) {
        store = {};
    }
};

/**
 * Saves the current preferences store to the settings file.
 */
const _save = () => {
    file.write(settings, store);
};

/**
 * Clears the preferences store and removes the associated settings file.
 */
exports.clear = () => {
    store = {};
    file.remove('$settings');
};

/**
 * Retrieves the value associated with the specified key from the preferences store.
 *
 * @param {string} key - The key to retrieve the value for.
 * @returns {*} The value associated with the key, or undefined if not found.
 */
exports.get = (key) => {
    if (store[key]) {
        return store[key];
    }
};

/**
 * Retrieves the key at the specified index in the storage.
 *
 * @param {number} index - The index of the key to retrieve.
 * @returns {string|null} The key at the specified index, or null if not found.
 */
exports.key = (index) => {
    const keys = Object.keys(store);
    return keys.length > index ? keys[index] : null;
};

/**
 * Removes the item associated with the given key from the preferences store.
 *
 * @param {string} key - The key of the item to remove.
 */
exports.remove = (key) => {
    delete store[key];
    _save();
};

/**
 * Adds a new key-value pair to the preferences store, or updates the value if the key already exists.
 *
 * @param {string} key - The key to set the value for.
 * @param {*} value - The value to set.
 * @returns {*} The value that was set.
 */
exports.set = (key, value) => {
    store[key] = value;
    _save();
    return value;
};

/**
 * Retrieves a value from the preferences store or sets it if not present.
 *
 * @param {string} key - The key to retrieve or set.
 * @param {*} value - The value to set if the key is not present.
 * @returns {*} The retrieved or set value.
 */
exports.getOrSet = (key, value) => {
    if (value !== undefined) {
        return this.set(key, value);
    } else {
        return this.get(key);
    }
};

_init();
