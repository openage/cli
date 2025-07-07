const cacheConfig = require('config').get('session.cache')
const moment = require('moment')

let store = null;

// Define the StorageService class
const init = () => {
    store = null;
    this.currentComponent = undefined;

    // Determine storage type based on environment configuration
    switch (cacheConfig.storage) {
    case 'session':
    case 'temporary':
    case 'none':
        store = require('../providers/cache/inprocess');
        break;
    case 'local':
    case 'permanent':
    default:
        store = require('../providers/cache/file');
        break;
    }
}

// Clear all items in the storage
exports.clear = () => {
    store.clear();
}

// Get an item and optionally build it if not found
exports.get = (id, builder) => {
    const item = store.get(id);

    if (item
    // && item.timeStamp &&
    // cacheConfig.duration && moment(item.timeStamp).add(cacheConfig.duration, 'm').isAfter(new Date())
    ) {
        return item;
    }

    if (!builder) {
        return
    }

    try {
        const value = builder();
        this.set(id, value);
        return value;

    } catch (err) {
        console.error(err);
        return null;
    }
}

// Set an item, converting objects to JSON strings
exports.set = (id, value) => {
    if (!value) {
        store.remove(id);
    } else {
        store.set(id, value);
    }
    return value;
}

// Update an item by key-value
exports.update = (id, value) => {
    return this.set(id, value);
}

// Remove an item by key
exports.remove = (id) => {
    store.removeItem(id);
}

exports.getOrSet = (key, value) => {
    if (value !== undefined) {
        return this.set(key, value);
    } else {
        return this.get(key)
    }
}

init()