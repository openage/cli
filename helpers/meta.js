
exports.set = (obj, key, value) => {
    let keys = key
    if (typeof keys === 'string') {
        keys = keys.split('.')
    }

    const setValue = (item) => {
        const current = keys.shift()

        if (!keys.length) {
            item[current] = value
        } else {
            item[current] = item[current] || {}
            setValue(item[current])
        }
    }

    return setValue(obj)
}

exports.get = (obj, key, value) => {
    let keys = key
    if (typeof keys === 'string') {
        keys = keys.split('.')
    }

    const getValue = (item) => {
        const current = keys.shift()

        if (!keys.length) {
            return item[current]
        } else if (item[current]) {
            return getValue(item[current])
        }
    }
    return getValue(obj)
}

exports.extend = item => {
    item.meta = item.meta || {}

    let consumed = {}
    const oldValues = {}

    item.meta.set = (key, value, old) => {
        oldValues[key] = old
        return this.set(item.meta, key, value)
    }

    item.meta.setCreated = (field) => {
        if (field) {
            return this.set(item.meta, `created.${field}`, true)
        }

        return this.set(item.meta, 'created', true)
    }

    item.meta.isCreated = (field) => {
        if (field) {
            return this.get(item.meta, `created.${field}`)
        }

        if (item.meta.keys('created').length > 0) {
            return true
        }
    }

    item.meta.setUpdated = (field, value, old) => {
        return this.set(item.meta, `updated.${field}`, value || true, old)
    }

    item.meta.isUpdated = (field) => {
        if (field) {
            return this.get(item.meta, `updated.${field}`)
        }

        if (item.meta.keys('updated').length > 0) {
            return true
        }
    }

    item.meta.resetConsumed = () => {
        consumed = {}
    }
    item.meta.popUpdated = (field) => {
        return item.meta.pop(`updated.${field}`)
    }
    item.meta.pop = (field) => {
        if (consumed[field]) {
            return null
        }
        consumed[field] = true
        return this.get(item.meta, field)
    }

    item.meta.get = (key) => {
        return this.get(item.meta, key)
    }

    item.meta.keys = (key) => {
        const obj = this.get(item.meta, key)

        if (!obj) {
            return []
        }

        return Object.keys(obj)
    }

    item.meta.serialize = () => {
        item.meta.set = undefined
        item.meta.get = undefined
        item.meta.serialize = undefined

        return item.meta
    }

    return item.meta
}
