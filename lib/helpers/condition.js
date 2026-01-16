export const check = (data, condition) => {
    if (Array.isArray(condition)) {
        condition = {
            operator: 'and',
            value: condition
        }
    }
    return evaluate(condition.key, condition.value, condition.operator, data)
}

const evaluate = (key, value, operator, data) => {

    operator = operator.toLowerCase().replace('$', '')

    // check aliases

    switch (operator) {
        case 'equals':
        case '=':
        case '==':
        case '===':
            operator = 'eq'
            break
        case '<>':
        case '!eq':
        case 'neq':
        case '!=':
        case '!==':
            operator = 'ne'
            break
        case '>':
            operator = 'gt'
            break
        case '>=':
            operator = 'gte'
            break
        case '<':
            operator = 'lt'
            break
        case '<=':
            operator = 'lte'
            break
        case '[]':
        case 'includes':
            operator = 'in'
            break
        case '][':
        case '!in':
        case 'nin':
        case 'notin':
        case 'excludes':
            operator = 'nin'
            break
        case '!empty':
        case 'defined':
            operator = 'exists'
            break
        case 'empty':
        case 'undefined':
        case 'notdefined':
        case '!defined':
        case '!exists':
            operator = 'notexists'
            break
        case '||':
            operator = 'or'
            break
        case '&&':
            operator = 'and'
            break
        default:
            break
    }

    let result = operator != 'or'
    value = value == 'null' || value == 'undefined' ? null : value

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const v = value[i]
            if (operator == 'or') {
                result = result || evaluate(v.key, v.value, v.operator, data)
            } else {
                result = result && evaluate(v.key, v.value, v.operator, data)
            }
        }
        return result
    } else {
        const keyValue = key ? key.split('.').reduce((data, level) => data && data[level], data) : data

        switch (operator) {
            case 'gt':
                return keyValue > value
            case 'lt':
                return keyValue < value
            case 'lte':
                return keyValue <= value
            case 'gte':
                return keyValue >= value
            case 'eq':
                return keyValue === value
            case 'ne':
                return keyValue != value
            case 'in':
                value = Array.isArray(value) ? value : [value]
                return value.includes(keyValue)
            case 'nin':
                value = Array.isArray(value) ? value : [value]
                return !value.includes(keyValue)
            case 'exists':
                return keyValue !== undefined // Check if the key exists
            case 'notexists':
                return keyValue === undefined // Check if the key does not exist
            default:
                return false // Return false for unsupported operators
        }

    }
}

const getValue = (obj, key, i = 0) => {
    if (typeof obj == 'object' && !Object.prototype.hasOwnProperty.call(obj, key[i])) {
        return null
    } else if (obj[key[i]] && typeof obj[key[i]] == 'object') {
        return getValue(obj[key[i]], key, i + 1)
    } else {
        return obj[key[i]]
    }
}
