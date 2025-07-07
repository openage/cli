exports.build = (context) => {
    let headers = {}
    headers['Content-Type'] = 'application/json'
    if (context.role) {
        headers['x-role-key'] = context.role.key
    } else if (context.user && context.user.role) {
        headers['x-role-key'] = context.user.role.key
    }

    if (context.tenant && context.tenant.code) {
        headers['x-tenant-code'] = context.tenant.code
    }

    if (context.session) {
        headers['x-session-id'] = context.session.id

        if (context.session.token) {
            headers['x-access-token'] = context.session.token
        }
    }

    if (context.id) {
        headers['x-context-id'] = context.id
    }

    return headers
}
