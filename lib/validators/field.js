import * as condition from '../helpers/condition.js'

export const validate = (validation, value) => {
    let actual = value[validation.field]
    const expected = {
        value: validation.value,
        operator: validation.operator || '='
    }
    return [{
        result: condition.check(actual, expected) ? 'pass' : 'fail',
        field: validation.field,
        expected: `${expected.operator} ${expected.value}`,
        actual: `${actual}`
    }]
}
