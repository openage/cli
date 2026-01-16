import Ajv from 'ajv'
import logger from '../helpers/logger.js'

function formatAjvErrors(errors, data) {
    if (!errors) {
        return [{
            result: 'pass',
            field: null,
            expected: 'Valid according to schema',
            actual: 'Valid'
        }]
    }

    return errors.map(err => {
        const field = err.instancePath ? err.instancePath.slice(1) : err.params.missingProperty || '(root)'
        return {
            result: 'fail',
            field,
            expected: err.message,
            actual: field.split('.').reduce((obj, key) => obj?.[key], data)
        }
    })
}

export const validate = (validation, value) => {

    const data = value[validation.field || 'data']

    const ajv = new Ajv()
    const valid = ajv.validate(validation.schema, data)
    logger('validators.schema').debug('validate', valid)

    return formatAjvErrors(valid ? null : ajv.errors, data)
}
