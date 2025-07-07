const cache = require('./cache');
const defaultConfig = require('config');
const alert = require('./alert');
const settings = require('./settings');
const logger = require('../helpers/logger');

exports.cache = cache;
exports.settings = settings;

/**
 * Clears the current cache.
 */
exports.clear = () => this.cache.clear();

/**
 * Retrieves or sets the interactive state in the settings.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current interactive state.
 */
exports.interactive = (item) => this.settings.getOrSet('interactive', item);

/**
 * Retrieves or sets the application state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current application state.
 */
exports.application = (item) => this.cache.getOrSet('application', item);

/**
 * Retrieves or sets the tenant state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current tenant state.
 */
exports.tenant = (item) => this.cache.getOrSet('tenant', item);

/**
 * Retrieves or sets the organization state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current organization state.
 */
exports.organization = (item) => this.cache.getOrSet('organization', item);

/**
 * Retrieves or sets the user state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current user state.
 */
exports.user = (item) => this.cache.getOrSet('user', item);

/**
 * Retrieves or sets the role state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current role state.
 */
exports.role = (item) => this.cache.getOrSet('role', item);

/**
 * Retrieves or sets the session state in the cache.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current session state.
 */
exports.session = (item) => this.cache.getOrSet('session', item);

/**
 * Retrieves or sets the impersonation state in the settings.
 *
 * @param {*} item - The value to set or retrieve.
 * @returns {*} The current impersonation state.
 */
exports.isImpersonating = (item) => this.settings.getOrSet('isImpersonateSession', item);

/**
 * Manages the impersonation of a session.
 *
 * @param {*} session - The session to impersonate.
 */
exports.impersonate = (session) => {
  if (session) {
    const lastSession = this.session();
    this.cache.update('lastSession', lastSession);
    this.session(session);
    this.isImpersonating(true);
  } else {
    const lastSession = this.cache.get('lastSession');
    this.session(lastSession);
    this.isImpersonating(false);
  }
};

/**
 * Checks if the current user has the specified permissions.
 *
 * @param {*} permissions - The permissions to check.
 * @returns {boolean} True if the user has the permissions, false otherwise.
 */
exports.hasPermission = (permissions) => {
  if (!permissions || (Array.isArray(permissions) && !permissions.length)) {
    return true;
  }

  const role = this.role();
  if (!role || !role.permissions.length) {
    return false;
  }

  if (typeof permissions === 'string') {
    return _hasPermission(permissions, role.permissions);
  }

  for (const permission of permissions) {
    if (_hasPermission(permission, role.permissions)) {
      return true;
    }
  }
  return false;
};

const _hasPermission = (permission, permissions) => {
  if (!permission) {
    return true;
  }

  let authorized = false;
  for (let item of permission.split('&&').map((p) => p.trim())) {
    const shouldNotHave = item.startsWith('!');
    if (shouldNotHave) {
      item = item.replace('!', '');
    }

    const value = permissions.find((i) => item.toLowerCase() === i.toLowerCase());

    if (value) {
      if (shouldNotHave) {
        return false;
      } else {
        authorized = true;
      }
    } else {
      if (shouldNotHave) {
        authorized = true;
      }
    }
  }
  return authorized;
};

/**
 * Retrieves a configuration value from the settings, application, organization, or tenant.
 *
 * @param {string} key - The key of the configuration value.
 * @param {*} defaultValue - The default value to return if the key is not found.
 * @returns {*} The configuration value.
 */
exports.config = {
  get: (key, defaultValue) => {
    const getValue = (identifier, value) => {
      if (!value) { return; }
      for (const key of identifier.split('.')) {
        if (!value[key]) {
          value = null;
          break;
        }
        value = value[key];
      }
      return value;
    };

    let value = settings.get(key);
    let application = this.application();

    if (application) {
      value = application ? getValue(key, application.config) : null;
    }

    if (!value) {
      let organization = this.organization();
      value = organization ? getValue(key, organization.config) : null;
    }

    if (!value) {
      let tenant = this.tenant();
      value = tenant ? getValue(key, tenant.config) : null;
    }

    if (!value && defaultConfig.has(key)) {
      value = defaultConfig.get(key);
    }

    if (!value) {
      value = defaultValue;
    }
    /* eslint-disable */
    if (!value) {
      switch (key) {
        case 'timeZone':
          return 'IST';
      }
    }
    /* eslint-enable */

    return value;
  }
};

/**
 * Retrieves a service configuration from the settings, application, organization, or tenant.
 *
 * @param {string} code - The code of the service.
 * @returns {*} The service configuration.
 */
exports.services = {
  get: (code) => {
    let service = settings.get(`services.${code}`);

    if (!service) {
      let application = this.application();
      if (application && application.services) {
        service = application.services.find(item => item.code === code);
      }
    }

    if (!service) {
      let organization = this.organization();
      if (organization && organization.services) {
        service = organization.services.find(item => item.code === code);
      }
    }

    if (!service) {
      let tenant = this.tenant();
      if (tenant && tenant.services) {
        service = tenant.services.find(item => item.code === code);
      }
    }

    if (!service && defaultConfig.has('services')) {
      let services = defaultConfig.get('services');
      service = services[code];
    }

    if (!service && defaultConfig.has('providers')) {
      let services = defaultConfig.get('providers');
      service = services[code];
    }

    return service;
  }
};

/**
 * Displays the current context information.
 */
exports.show = () => {
  if (!this.interactive()) {
    return;
  }
  let context = this.toObject();

  if (context.tenant) {
    alert.banner(context.tenant.name || context.tenant.code);
  }

  if (context.application) {
    alert.message('Application', `${context.application.name || context.application.code}[${context.application.env || 'prod'}]`);
  }

  if (context.role) {
    alert.message('You are logged in as:');

    if (context.role.profile) {
      alert.message('Name', `${context.role.profile.firstName} ${context.role.profile.lastName || ''}`);
    }

    if (context.role.organization) {
      alert.message('Organization', context.role.organization.name || context.role.organization.code);
    }
  }
};

/**
 * Converts the current context to an object.
 *
 * @returns {*} The current context as an object.
 */
exports.toObject = () => {
  return {
    application: this.application(),
    tenant: this.tenant(),
    organization: this.organization(),
    user: this.user(),
    role: this.role(),
    session: this.session(),
    isImpersonating: this.isImpersonating(),
    logger: logger,
    services: this.services,
    config: this.config
  };
};
