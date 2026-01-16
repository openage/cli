import * as oa from './oa.js'
import * as context from './context.js'
import * as notifications from '../helpers/notifications.js'
import { settings } from '../helpers/data.js'
import * as input from '../helpers/input.js'
import logger from '../helpers/logger.js'

/**
 * Initializes the authentication process by checking the current session and role.
 */
export const init = async () => {
    let session = context.session()

    if (session) {
        try {
            session = await oa.directory.sessions.get(session.id, context.toObject())
            if (session.status === 'active') {
                context.session(session)
                return session
            }

            // let role = await oa.directory.roles.get('my', context.toObject())
            // if (role) {
            //     _setRole(role)
            //     return session
            // }
        } catch (e) {
            logger('services.auth').error(e)
        }
    }

    return login()
}

/**
 * Sets the current session in the context and updates the user and role information.
 */
const _setSession = async (item) => {
    context.session(item)
    _setUser(item.user)
    _setRole(item.role)

    return item
}

/**
 * Updates the user information in the context.
 */
const _setUser = (item) => {
    if (item) {
        item.meta = item.meta || {}
    }
    context.user(item)
    return item
}

/**
 * Updates the role information in the context.
 */
const _setRole = (item) => {
    let user = context.user() || {}
    item.email = item.email || user.email
    item.phone = item.phone || user.phone
    context.role(item)
    context.organization(item.organization)
    return item
}

/**
 * Logs in using credentials.
 */
const _loginByCredentials = async () => {
    let email = settings.get('credentials.email')
    if (!email) {
        email = await input.get('email')
        settings.get('credentials.email', email)
    }

    let password = settings.get('credentials.password')
    if (!password) {
        password = await input.get('password')
        settings.get('credentials.password', password)
    }

    let session = await oa.directory.sessions.create({
        user: {
            email: email
        },
        credentials: {
            password: password
        }
    }, context.toObject())

    return _setSession(session)
}

/**
 * Logs in using web authentication.
 */
const _loginByWeb = async (activateUrl) => {
    let session = await oa.directory.sessions.create({
        purpose: 'login'
    }, context.toObject())

    activateUrl = `${activateUrl}?session-id=${session.id}`

    notifications.info('Activate Session', `Your session needs to be activated to continue. If the website did not open automatically, please copy and paste the link into your browser ${activateUrl}`)
    await input.web(activateUrl)

    let count = 0
    let attempts = 10

    const checkSession = (resolve, reject) => {
        notifications.progress(count, attempts)
        oa.directory.sessions.get(session.id, context.toObject()).then(r => {
            if (r.status === 'active') {
                resolve(context.session(r))
            } else {
                count++
                if (count < attempts) {
                    setTimeout(() => {
                        checkSession(resolve, reject)
                    }, 2000)
                } else {
                    notifications.error('Could not activate session')
                }
            }
        }, err => {
            notifications.error(err)
            reject(err)
        })
    }

    return new Promise((resolve, reject) => {
        checkSession(resolve, reject)
    })
}

/**
 * Triggers the login process based on the application configuration.
 */
export const login = async () => {
    let application = context.application()
    let activateUrl = application.navs.find(n => n.code === 'sessions.activate')
    if (activateUrl) {
        return _loginByWeb(activateUrl)
    }

    return _loginByCredentials()
}

/**
 * Signs out the current session and clears the context.
 */
export const logout = async () => {
    let session = context.session()

    if (session) {
        await oa.directory.sessions.remove(session.id, context.toObject())
    }
    context.clear()
    notifications.info('Successfully Logged Out!')
}
