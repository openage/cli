import * as file from './file.js'
import * as crypto from './crypto.js'

/**
 * Recursively walks an object/array and decrypts any nodes that are marked
 * as encrypted. Non-object values are returned as-is.
 *
 * If `options.decrypt` is `false`, encrypted nodes will be replaced with
 * a redaction string (`"******"`). By default encrypted nodes are
 * decrypted.
 *
 * @param {*} obj - The value to walk (object, array, or primitive).
 * @param {{decrypt?: boolean}} [options] - Options controlling decryption.
 * @returns {*} The input with encrypted nodes decrypted or redacted.
 */
function walkAndDecrypt(obj, options) {
    if (obj === null || typeof obj !== 'object') return obj

    // If this is an encrypted node, decrypt it
    if (
        obj.encrypted === true &&
        typeof obj.salt === 'string' &&
        typeof obj.iv === 'string' &&
        typeof obj.data === 'string'
    ) {

        if (options?.decrypt || options?.decrypt === undefined) {
            return crypto.decrypt(obj) // returns plain text
        } else {
            return '******'
        }
    }

    // Otherwise walk deeper
    if (Array.isArray(obj)) {
        return obj.map(item => walkAndDecrypt(item, options))
    }

    const result = {}
    for (const key of Object.keys(obj)) {
        result[key] = walkAndDecrypt(obj[key], options)
    }
    return result
}

/**
 * Checks whether the provided value is a plain object (not null, not an array).
 *
 * @param {*} item - Value to test.
 * @returns {boolean} True when the value is a non-null object and not an array.
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deeply merges two plain objects. For object properties the merge is
 * recursive; arrays in the `source` replace arrays in the `target`; primitive
 * values from `source` overwrite `target`.
 *
 * @param {object} target - Base object.
 * @param {object} source - Object with properties to merge into `target`.
 * @returns {object} A new object containing the merged values.
 */
function deepMerge(target, source) {
    const output = { ...target }

    if (isObject(target) && isObject(source)) {
        for (const key of Object.keys(source)) {
            const sourceValue = source[key]
            const targetValue = target[key]

            if (isObject(sourceValue)) {
                // If both values are objects, merge them
                output[key] = deepMerge(
                    targetValue || {},
                    sourceValue
                )
            } else if (Array.isArray(sourceValue)) {
                // Arrays: replace or customize (here we replace)
                output[key] = [...sourceValue]
            } else {
                // Primitive values just overwrite
                output[key] = sourceValue
            }
        }
    }

    return output
}

/**
 * Creates a data service scoped to a given settings path. The path should be
 * in the form "folder/filename" (filename without extension). The returned
 * object exposes `get`, `set`, `remove`, `clear`, and `getOrSet` helpers for
 * interacting with the JSON file(s) on disk. When an environment-specific
 * file exists (e.g. `name.<env>.json`) it will be used alongside the
 * default file.
 *
 * @param {string} folder - The settings path in the form `folder`.
 */
const wrapper = (folder) => {

    const defaultFileConfig = {
        folder: folder,
        file: 'default.json'
    }

    if (!file.exists(defaultFileConfig)) {
        file.write(defaultFileConfig, {})
    }

    const _defaultValues = file.read(defaultFileConfig)

    let _values = _defaultValues
    let fileConfig = defaultFileConfig

    let env = process.env.NODE_ENV || _defaultValues['env'] || 'prod'
    if (env) {
        fileConfig = {
            folder: folder,
            file: `${env}.json`
        }

        if (!file.exists(fileConfig)) {
            file.write(fileConfig, {})
        }
        _values = file.read(fileConfig)
    }

    const data = {}

    /**
     * Retrieves a value from the settings based on the provided key.
     *
     * @param {string} key - The key to retrieve the value for.
     * @returns {*} The value associated with the key, or null if not found.
     */
    data.get = (key, options) => {
        if (!key) {
            const obj = env ? deepMerge(_defaultValues, _values) : _values
            return walkAndDecrypt(obj, options)
        }

        const getValue = (values) => {
            let value = values
            for (const part of key.split('.')) {
                if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(value, part)) {
                    return null
                }
                value = value[part]
            }
            return value
        }

        let value

        if (options?.default) {
            value = getValue(_defaultValues)
        }

        if (!value) {
            value = getValue(_values)
        }

        if (!value && env) {
            value = getValue(_defaultValues)
        }

        if (value && value.encrypted) {
            if (options?.decrypt || options?.decrypt === undefined) {
                value = crypto.decrypt(value)
            } else {
                value = '******'
            }
        }
        return value
    }
    /**
     * Sets a value in the settings based on the provided key.
     *
     * @param {string} key - The key to set the value for.
     * @param {*} obj - The value to set.
     * @returns {*} The value that was set.
     */
    data.set = (key, obj, options) => {
        const parts = key.split('.')
        let value = options?.default ? _defaultValues : _values

        for (let index = 0; index < parts.length - 1; index++) {
            const part = parts[index]

            if (!Object.prototype.hasOwnProperty.call(value, part) || typeof value[part] !== 'object') {
                value[part] = {} // Ensure intermediate properties are objects.
            }

            value = value[part]
        }

        if (options?.encrypt) {
            obj = crypto.encrypt(obj)
        }

        value[parts[parts.length - 1]] = obj

        if (options?.default) {
            file.write(defaultFileConfig, _defaultValues)
        } else {
            file.write(fileConfig, _values)
        }
        return value
    }

    /**
     * Removes the value at the provided key by setting it to `undefined` and
     * writing the file. Supports the same `options` as `set` (e.g. `encrypt`).
     *
     * @param {string} key - Dot-separated key path to remove.
     * @param {{encrypt?: boolean}} [options] - Optional options passed to `set`.
     * @returns {void}
     */
    data.remove = (key, options) => {
        data.set(key, undefined, options)
    }

    /**
     * Clears all values in the current file by writing an empty object.
     *
     * @returns {void}
     */
    data.clear = () => {
        file.write(fileConfig, {})
    }
    /**
     * Retrieves a value from the settings or sets it if not present.
     *
     * @param {string} key - The key to retrieve or set.
     * @param {*} value - The value to set if the key is not present.
     * @returns {*} The retrieved or set value.
     */
    data.getOrSet = (key, value) => {
        let val = data.get(key)

        if (val === null && value !== undefined) {
            data.set(key, value)
            val = value
        }

        return val
    }
    return data
}

export const cache = wrapper('$cache')
export const specs = wrapper('$cache/specs')
export const response = wrapper('$cache/responses')
export const settings = wrapper('$oa/settings')
export const input = wrapper('$data/input')
