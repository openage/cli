import * as httpHelper from './http.js'
import FormData from 'form-data'
import * as fs from 'fs'

/**
 * Builds HTTP headers from the provided context, including authentication tokens,
 * role keys, tenant/organization codes, and session/context IDs.
 *
 * @param {object} context - The request context containing session, user, role, tenant, organization, and id.
 * @returns {object} Headers object with required authentication and metadata.
 */
const buildHeader = (context) => {
    let headers = {}
    headers['Content-Type'] = 'application/json'

    if (context.session?.token) {
        headers['x-access-token'] = context.session.token
    } else {
        if (context.role?.key) {
            headers['x-role-key'] = context.role.key
        } else if (context.user?.role?.key) {
            headers['x-role-key'] = context.user.role.key
        }
    }
    if (context.tenant?.code) {
        headers['x-tenant-code'] = context.tenant.code
    }
    if (context.organization?.code) {
        headers['x-organization-code'] = context.organization.code
    }

    if (context.application?.code) {
        headers['x-application-code'] = context.application.code
    }

    if (context.session?.id) {
        headers['x-session-id'] = context.session.id
    }

    if (context.id) {
        headers['x-context-id'] = context.id
    }

    return headers
}

/**
 * Creates a remote data service for a given service code and collection.
 * Provides CRUD operations (create, read, update, delete) and utility methods
 * for interacting with a remote API.
 *
 * @param {string} serviceCode - The service identifier to resolve in the request URL.
 * @param {string} collection - The collection/resource name for API paths.
 * @returns {object} An object with methods: create, search, get, exists, update, remove, post, upload.
 */
export default (serviceCode, collection) => {

    /**
     * Sends a POST request with the provided model data. Note: the method defaults
     * to 'get' in the HTTP call (likely a bug—intended to be 'post').
     *
     * @private
     * @param {object} model - The data model to send.
     * @param {object} [options] - Optional query parameters and path extensions.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<*>} The response data.
     */
    const post = async (model, options, context) => {
        options = options || {}
        let response = await httpHelper.execute({
            method: 'post',
            url: '${' + serviceCode + '}',
            path: (options.path ? `${collection}/${options.path}` : collection),
            query: options.query,
            data: model,
            headers: buildHeader(context)
        }, context)

        return response.data
    }

    /**
     * Uploads a file to the collection endpoint using multipart/form-data.
     *
     * @private
     * @param {object} file - File object containing a path property.
     * @param {object} [options] - Optional query parameters and path extensions.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<Array>} Array of items from the response.
     */
    const upload = async (file, options, context) => {
        options = options || {}

        let headers = buildHeader(context)
        headers['Content-Type'] = 'multipart/form-data'

        const form = new FormData()
        form.append('file', fs.createReadStream(file.path))
        headers = { ...headers, ...form.getHeaders() }

        let response = await httpHelper.execute({
            method: 'post',
            url: '${' + serviceCode + '}',
            path: (options.path ? `${collection}/${options.path}` : collection),
            query: options.query,
            data: form,
            headers: headers
        }, context)

        return response.data?.items
    }

    /**
     * Searches the collection using a query object.
     *
     * @private
     * @param {object} [query] - Query parameters for filtering.
     * @param {object} [options] - Optional path extensions and additional query params.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<Array>} Array of items matching the search criteria.
     */
    const search = async (query, options, context) => {
        options = options || {}
        let response = await httpHelper.execute({
            method: 'get',
            url: '${' + serviceCode + '}',
            path: (options.path ? `${collection}/${options.path}` : collection),
            query: query || options.query,
            headers: buildHeader(context)
        }, context)

        return response.data?.items
    }

    /**
     * Retrieves a single resource by ID.
     *
     * @private
     * @param {string|number} id - The resource ID.
     * @param {object} [options] - Optional query parameters.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<*>} The resource data.
     */
    const get = async (id, options, context) => {
        options = options || {}
        let response = await httpHelper.execute({
            method: 'get',
            url: '${' + serviceCode + '}',
            path: `${collection}/${id}`,
            query: options.query,
            headers: buildHeader(context)
        }, context)
        return response.data
    }

    /**
     * Checks if a resource exists by attempting to fetch it.
     * Returns the resource ID if it exists, false if it does not.
     *
     * @private
     * @param {string|number} id - The resource ID.
     * @param {object} [options] - Optional query parameters.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<string|number|boolean>} The resource ID if found, false otherwise.
     */
    const exists = async (id, options, context) => {
        options = options || {}
        try {
            let response = await httpHelper.execute({
                method: 'get',
                url: '${' + serviceCode + '}',
                path: `${collection}/${id}`,
                query: options.query,
                headers: buildHeader(context)
            }, context)
            return response.data?.id
        } catch (err) {
            return false
        }
    }

    /**
     * Updates a resource by ID using a PUT request.
     *
     * @private
     * @param {string|number} id - The resource ID.
     * @param {object} model - The updated data model.
     * @param {object} [options] - Optional query parameters.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<*>} The updated resource data.
     */
    const put = async (id, model, options, context) => {
        options = options || {}

        let response = await httpHelper.execute({
            method: 'put',
            url: '${' + serviceCode + '}',
            path: `${collection}/${id}`,
            query: options.query,
            data: model,
            headers: buildHeader(context)
        }, context)
        return response.data
    }

    /**
     * Deletes a resource by ID.
     *
     * @private
     * @param {string|number} id - The resource ID.
     * @param {object} [options] - Optional query parameters.
     * @param {object} [context] - Request context for headers.
     * @returns {Promise<*>} The response data.
     */
    const remove = async (id, options, context) => {
        options = options || {}
        let response = await httpHelper.execute({
            method: 'delete',
            url: '${' + serviceCode + '}',
            path: `${collection}/${id}`,
            query: options.query,
            headers: buildHeader(context)
        }, context)
        return response.data
    }

    return {
        /**
         * Creates a new resource.
         * @param {object} model - The data model for the new resource.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<*>} The created resource data.
         */
        create: async (model, context) => {
            return post(model, {}, context)
        },
        /**
         * Searches for resources matching the query.
         * @param {object} [query] - Query parameters for filtering.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<Array>} Array of matching resources.
         */
        search: async (query, context) => {
            return search(query, {}, context)
        },
        /**
         * Retrieves a single resource by ID. Supports optional parameters:
         * `get(id, context)` or `get(id, options, context)`.
         * @param {string|number} id - The resource ID.
         * @param {object} [param1] - Either options or context depending on param2.
         * @param {object} [param2] - Context (only provided if param1 is options).
         * @returns {Promise<*>} The resource data.
         */
        get: async (id, param1, param2) => {
            let options = {}
            let context = {}

            if (param2) {
                options = param1
                context = param2
            } else {
                context = param1
            }

            return get(id, options, context)
        },
        /**
         * Checks if a resource exists. Supports optional parameters:
         * `exists(id, context)` or `exists(id, options, context)`.
         * @param {string|number} id - The resource ID.
         * @param {object} [param1] - Either options or context depending on param2.
         * @param {object} [param2] - Context (only provided if param1 is options).
         * @returns {Promise<string|number|boolean>} The resource ID if found, false otherwise.
         */
        exists: async (id, param1, param2) => {
            let options = {}
            let context = {}

            if (param2) {
                options = param1
                context = param2
            } else {
                context = param1
            }

            return exists(id, options, context)
        },
        /**
         * Updates a resource by ID.
         * @param {string|number} id - The resource ID.
         * @param {object} model - The updated data model.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<*>} The updated resource data.
         */
        update: async (id, model, context) => {
            return put(id, model, {}, context)
        },
        /**
         * Deletes a resource by ID.
         * @param {string|number} id - The resource ID.
         * @param {object} [options] - Optional query parameters.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<*>} The response data.
         */
        remove: async (id, options, context) => {
            return remove(id, options, context)
        },
        /**
         * Sends a custom POST request with model and options.
         * @param {object} model - The data model to send.
         * @param {object} [options] - Optional query parameters and path extensions.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<*>} The response data.
         */
        post: async (model, options, context) => {
            return post(model, options, context)
        },
        /**
         * Uploads a file to the collection endpoint.
         * @param {object} file - File object with a path property.
         * @param {object} [options] - Optional query parameters and path extensions.
         * @param {object} [context] - Request context for headers.
         * @returns {Promise<Array>} Array of items from the upload response.
         */
        upload: async (file, options, context) => {
            return upload(file, options, context)
        }
    }
}
