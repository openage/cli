import * as input from '../helpers/input.js'
import * as context from '../services/context.js'
import * as notifications from '../helpers/notifications.js'

/**
 * Retrieves context information.
 *
 * @param {Object} params - The options for the process.
 * example
 * oa context session.token           // gets the value
 */
export const execute = async (params) => {
    const ctx = context.toObject()

    if (!params.key) {
        notifications.data('', {
            session: ctx.session,
            role: ctx.role,
            user: ctx.user,
            tenant: ctx.tenant,
            application: ctx.application,
            organization: ctx.organization
        })
        return
    }

    let value = ctx

    for (const key of params.key.split('.')) {
        if (value && value[key] !== undefined) {
            value = value[key]
        } else {
            value = undefined
            break
        }
    }

    if (value !== undefined) {
        notifications.data(params.key, value)
    } else {
        notifications.error(new Error('CONTEXT_KEY_NOT_FOUND', { cause: { key: params.key } }))
    }
}

export const parse = (args) => {
    const params = {}
    if (args.length > 0) {
        params.key = input.parse(args[0])
    }
    return params
}
