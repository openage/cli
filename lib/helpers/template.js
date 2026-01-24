import handlebars from 'handlebars'
import { date as dates, time as times } from './dates.js'
import text from './text.js'
import num from './number.js'
import * as condition from './condition.js'

const helpers = {
    // {{date 23-12-2025 'ISO'}}
    'date': function (value, format) {
        return dates(value).toString(format || 'DD-MM-YYYY')
    },

    'time': function (value, format) {
        return times(value).toString(format || 'hh:mm:ss A')
    },

    // {{number (convert amount currency 'INR' ratios 'totalA') 'commas'}} INR
    // {{number 123 'en-IN'}}
    // {{number 123 'words'}}
    'number': function (value, format) {
        return num(value).toString(format)
    },

    // {{calculate [1, 2, 3] 'sum'}}
    'calculate': function (values, operation) {
        return num(values).calculate(operation)
    },

    // {{condition 1 'gt' 2}}
    'condition': function (value, operator, value2) {

        const meets = condition.check(value, {
            operator: operator,
            value: value2

        })
        const next = arguments[arguments.length - 1]
        return meets ? next.fn(this) : next.inverse(this)
    },

    // {{text 'some text' 'upper'}}
    'text': function (value, format) {
        return text(value).toString(format)
    },

    'sub': function (value, from, length) {
        return text(value).sub(from, length)
    },

    // replace all the instances of any symbol or character from the string
    'replace': function (value, search, replace) {
        return text(value).replace(search, replace)
    },

    // split the string with a symbol and access any part using index(+ve/-ve)
    'segment': function (value, separator, index) {
        return text(value).segment(separator, index)
    },

    'find': function (array, key, value) {
        if (!Array.isArray(array)) return ''

        const match = array.find(item => item?.[key] === value)
        if (!match) return ''

        return match
    },

    'get': function (obj, path) {
        if (!obj || !path) return ''
        // if no path specified, return the matched object
        if (!path) return JSON.stringify(obj)

        return path.split('.').reduce((acc, key) => acc?.[key], obj)
    }
,
    // {{lookup collection indexOrKey}}
    'lookup': function (obj, key) {
        if (obj == null) return ''

        // convert numeric-like keys
        if (typeof key === 'string' && /^\d+$/.test(key)) {
            key = parseInt(key, 10)
        }

        // support dot-path keys (e.g. "a.b.c") when passed as string
        if (typeof key === 'string' && key.includes('.')) {
            return key.split('.').reduce((acc, k) => acc?.[k], obj)
        }

        return obj[key]
    }
}

export const formatter = function (format) {
    const isObject = typeof format === 'object'

    if (isObject) {
        format = JSON.stringify(format)
    }
    const template = handlebars.compile(format)
    return {
        inject: (data) => {
            let value = template(data)

            if (isObject) {
                return JSON.parse(value.replace(/\\/g, '\\\\'))
            }

            return value
        }
    }
}

const init = () => {
    for (const key in helpers) {
        if (!Object.hasOwn(helpers, key)) continue

        const fn = helpers[key]

        handlebars.registerHelper(key, helpers[key])

    }
}

init()
