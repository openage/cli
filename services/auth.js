const config = require('config');
const oa = require('@open-age/client');
const context = require('./context');
const alert = require('./alert');
const input = require('../helpers/input');
const logger = require('../helpers/logger');

/**
 * Initializes the authentication process by checking the current session and role.
 */
exports.init = async () => {
    let session = context.session();

    if (session) {
        try {
            // session = await oa.directory.sessions.get(session.id, context.toObject());
            // if (session.status === 'active') {
            //     context.session(session)
            //     return session
            // }

            let role = await oa.directory.roles.get('my', context.toObject());
            if (role) {
                _setRole(role);
                return session;
            }
        } catch (e) {
            logger.error(e);
        }
    }

    return this.login();
};

/**
 * Sets the current session in the context and updates the user and role information.
 */
const _setSession = async (item) => {
    context.session(item);
    _setUser(item.user);
    _setRole(item.role);

    return item;
};

/**
 * Updates the user information in the context.
 */
const _setUser = (item) => {
    if (item) {
        item.meta = item.meta || {};
    }
    context.user(item);
    return item;
};

/**
 * Updates the role information in the context.
 */
const _setRole = (item) => {
    let user = context.user() || {};
    item.email = item.email || user.email;
    item.phone = item.phone || user.phone;
    context.role(item);
    context.organization(item.organization);
    return item;
};

/**
 * Logs in using credentials.
 */
const _loginByCredentials = async () => {
    let email = await input.get('email');
    let password = await input.get('password');
    let session = await oa.directory.auth.signIn(email, null, null, password, context.toObject());

    return _setSession(session);
};

/**
 * Logs in using web authentication.
 */
const _loginByWeb = async (activateUrl) => {
    let session = await oa.directory.sessions.create({
        purpose: 'login'
    }, context.toObject());

    activateUrl = `${activateUrl}?session-id=${session.id}`;

    alert.info('Activate Session', `Your session needs to be activated to continue. If the website did not open automatically, please copy and paste the link into your browser ${activateUrl}`);
    await input.web(activateUrl);

    let count = 0;
    let attempts = 10;

    const checkSession = (resolve, reject) => {
        alert.progress(count, attempts);
        oa.directory.sessions.get(session.id, context.toObject()).then(r => {
            if (r.status === 'active') {
                resolve(context.session(r));
            } else {
                count++;
                if (count < attempts) {
                    setTimeout(() => {
                        checkSession(resolve, reject);
                    }, 2000);
                } else {
                    alert.error('Could not activate session');
                }
            }
        }, err => {
            alert.error(err);
            reject(err);
        });
    };

    return new Promise((resolve, reject) => {
        checkSession(resolve, reject);
    });
};

/**
 * Triggers the login process based on the application configuration.
 */
exports.login = async () => {
    if (config.has('credentials')) {
        credentials = config.get('credentials');
        return oa.directory.auth.signIn(credentials.email, credentials.code, credentials.mobile, credentials.password, context.toObject());
    }

    let application = context.application();
    let activateUrl = application.navs.find(n => n.code === 'sessions.activate');
    if (activateUrl) {
        return _loginByWeb(activateUrl);
    }

    return _loginByCredentials();
};

/**
 * Signs out the current session and clears the context.
 */
exports.logout = async () => {
    let session = context.session();

    if (session) {
        await oa.directory.auth.signOut(session, context.toObject());
    }
    context.clear();
    console.log('Successfully Logged Out!');
};
