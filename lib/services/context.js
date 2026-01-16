import { cache, settings } from '../helpers/data.js'
import * as notification from '../helpers/notifications.js'
import logger from '../helpers/logger.js'
import * as contextProvider from '../../src/providers/context.js'

const _ctx = {}

_ctx.paths = contextProvider.paths
_ctx.cache = cache

export const env = (value) => {
    if (value) {
        settings.set('env', value, { default: true })
    } else {
        value = settings.get('env', { default: true })
        if (!value) {
            value = process.env.NODE_ENV || 'prod'
            settings.set('env', value, { default: true })
        }
    }
    process.env.NODE_ENV = value
    return value
}

/**
 * Clears the current cache.
 */
_ctx.clear = () => cache.clear()

/**
 * Retrieves or sets the application state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current application state.
 */
_ctx.application = (item) => cache.getOrSet('application', item)

/**
 * Retrieves or sets the tenant state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current tenant state.
 */
_ctx.tenant = (item) => cache.getOrSet('tenant', item)

/**
 * Retrieves or sets the organization state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current organization state.
 */
_ctx.organization = (item) => cache.getOrSet('organization', item)

/**
 * Retrieves or sets the user state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current user state.
 */
_ctx.user = (item) => cache.getOrSet('user', item)

/**
 * Retrieves or sets the role state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current role state.
 */
_ctx.role = (item) => cache.getOrSet('role', item)

/**
 * Retrieves or sets the session state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current session state.
 */
_ctx.session = (item) => cache.getOrSet('session', item)

/**
 * Retrieves or sets the impersonation state in the settings.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current impersonation state.
 */
_ctx.isImpersonating = (item) => settings.getOrSet('isImpersonateSession', item)

/**
 * Manages the impersonation of a session.
 *
 * @param {*} session - The session to impersonate.
 */
_ctx.impersonate = (session) => {
    if (session) {
        const lastSession = _ctx.session()
        cache.set('lastSession', lastSession)
        _ctx.session(session)
        _ctx.isImpersonating(true)
    } else {
        const lastSession = cache.get('lastSession')
        _ctx.session(lastSession)
        _ctx.isImpersonating(false)
    }
}

/**
 * Checks if the current user has the specified permissions.
 *
 * @param {*} permissions - The permissions to check.
 * @returns {boolean} True if the user has the permissions, false otherwise.
 */
_ctx.hasPermission = (permissions) => {
    if (!permissions || (Array.isArray(permissions) && !permissions.length)) {
        return true
    }

    const role = _ctx.role()
    if (!role || !role.permissions.length) {
        return false
    }

    if (typeof permissions === 'string') {
        return _hasPermission(permissions, role.permissions)
    }

    for (const permission of permissions) {
        if (_hasPermission(permission, role.permissions)) {
            return true
        }
    }
    return false
}

const _hasPermission = (permission, permissions) => {
    if (!permission) {
        return true
    }

    let authorized = false
    for (let item of permission.split('&&').map((p) => p.trim())) {
        const shouldNotHave = item.startsWith('!')
        if (shouldNotHave) {
            item = item.replace('!', '')
        }

        const value = permissions.find((i) => item.toLowerCase() === i.toLowerCase())

        if (value) {
            if (shouldNotHave) {
                return false
            } else {
                authorized = true
            }
        } else {
            if (shouldNotHave) {
                authorized = true
            }
        }
    }
    return authorized
}

/**
 * Retrieves a configuration value from the settings, application, organization, or tenant.
 *
 * @param {string} key - The key of the configuration value.
 * @param {*} defaultValue - The default value to return if the key is not found.
 * @returns {*} The configuration value.
 */
_ctx.config = {
    get: (key, defaultValue) => {
        const getValue = (identifier, value) => {
            if (!value) { return }
            for (const key of identifier.split('.')) {
                if (!value[key]) {
                    value = null
                    break
                }
                value = value[key]
            }
            return value
        }

        let value = settings.get(key)
        let application = _ctx.application()

        if (application) {
            value = application ? getValue(key, application.config) : null
        }

        if (!value) {
            let organization = _ctx.organization()
            value = organization ? getValue(key, organization.config) : null
        }

        if (!value) {
            let tenant = _ctx.tenant()
            value = tenant ? getValue(key, tenant.config) : null
        }

        if (!value) {
            value = settings.get(key)
        }

        if (!value) {
            value = defaultValue
        }

        if (!value) {
            switch (key) {
                case 'timeZone':
                    return 'IST'
            }
        }

        return value
    }
}

/**
 * Retrieves a service configuration from the settings, application, organization, or tenant.
 *
 * @param {string} code - The code of the service.
 * @returns {*} The service configuration.
 */
_ctx.services = {
    get: (code) => {
        let service = settings.get(`services.${code}`)

        if (!service) {
            let application = _ctx.application()
            if (application && application.services) {
                service = application.services.find(item => item.code === code)
            }
        }

        if (!service) {
            let organization = _ctx.organization()
            if (organization && organization.services) {
                service = organization.services.find(item => item.code === code)
            }
        }

        if (!service) {
            let tenant = _ctx.tenant()
            if (tenant && tenant.services) {
                service = tenant.services.find(item => item.code === code)
            }
        }

        return service
    }
}

/**
 * Displays the current context information.
 */
_ctx.show = () => {
    let context = _ctx.toObject()
    if (context.tenant) {
        notification.message(`${context.tenant.name || context.tenant.code}`, 'banner')
    }
    if (context.application) {
        notification.message(`Application: ${context.application.name || context.application.code} [${context.application.env || 'prod'}]`, 'warn')
    }

    if (context.user?.profile) {
        notification.message(`User: ${context.user.profile.firstName} ${context.user.profile.lastName || ''}${context.role?.type ? '(' + (context.role.type.name || context.role.type.code) + ')' : ''}`, 'warn')
    }
    if (context.organization) {
        notification.message(`Organization: ${context.role.organization.name || context.role.organization.code}`, 'warn')
    }
}

/**
 * Converts the current context to an object.
 *
 * @returns {*} The current context as an object.
 */
_ctx.toObject = () => {
    return {
        application: _ctx.application(),
        tenant: _ctx.tenant(),
        organization: _ctx.organization(),
        user: _ctx.user(),
        role: _ctx.role(),
        session: _ctx.session(),
        isImpersonating: _ctx.isImpersonating(),
        logger: logger,
        services: _ctx.services,
        config: _ctx.config
    }
}

export const paths = _ctx.paths
export const clear = _ctx.clear
export const application = _ctx.application
export const tenant = _ctx.tenant
export const organization = _ctx.organization
export const user = _ctx.user
export const role = _ctx.role
export const session = _ctx.session
export const isImpersonating = _ctx.isImpersonating
export const impersonate = _ctx.impersonate
export const hasPermission = _ctx.hasPermission
export const config = _ctx.config
export const services = _ctx.services
export const show = _ctx.show
export const toObject = _ctx.toObject
export default _ctx
