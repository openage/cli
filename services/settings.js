const file = require('../helpers/file');

const config = {
  folder: '$cache',
  file: 'settings.json'
};

if (!file.exists(config)) {
  file.write(config, {});
}

let settings = file.read(config);

/**
 * Retrieves a value from the settings based on the provided key.
 *
 * @param {string} key - The key to retrieve the value for.
 * @returns {*} The value associated with the key, or null if not found.
 */
exports.get = (key) => {
  let value = settings;
  for (const part of key.split('.')) {
    if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(value, part)) {
      return null;
    }
    value = value[part];
  }
  return value;
};

/**
 * Sets a value in the settings based on the provided key.
 *
 * @param {string} key - The key to set the value for.
 * @param {*} obj - The value to set.
 * @returns {*} The value that was set.
 */
exports.set = (key, obj) => {
  const parts = key.split('.');
  let value = settings;

  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];

    if (!Object.prototype.hasOwnProperty.call(value, part) || typeof value[part] !== 'object') {
      value[part] = {}; // Ensure intermediate properties are objects.
    }

    value = value[part];
  }

  value[parts[parts.length - 1]] = obj;

  file.write(config, settings);

  return value;
};

/**
 * Retrieves a value from the settings or sets it if not present.
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