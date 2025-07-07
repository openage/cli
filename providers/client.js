const client = require('@open-age/client');

/**
 * Creates a client handler for managing commands with the Open Age client.
 *
 * @param {Object} command - The command object containing service and collection information.
 * @param {Object} context - The context for the command execution.
 * @returns {Object} The handler object with methods for CRUD operations.
 */
module.exports = (command, context) => {
    let handler = client[command.service][command.collection];

    return {
        /**
         * Creates a new model in the collection.
         *
         * @param {Object} model - The model to create.
         * @returns {Promise<Object>} The created model.
         */
        post: async (model) => {
            model = model || command.model;
            return handler.create(model, context);
        },

        /**
         * Updates an existing model in the collection.
         *
         * @param {Object} model - The model to update.
         * @returns {Promise<Object>} The updated model.
         */
        put: async (model) => {
            model = model || command.model || {};
            let id = model.id || command.id;
            return handler.update(id, model, context);
        },

        /**
         * Searches for models in the collection based on a query.
         *
         * @param {string} query - The search query.
         * @returns {Promise<Array>} The search results.
         */
        search: async (query) => {
            query = query || command.query;
            return handler.search(query, context);
        },

        /**
         * Retrieves a model by its ID.
         *
         * @param {string} id - The ID of the model to retrieve.
         * @returns {Promise<Object>} The retrieved model.
         */
        get: async (id) => {
            id = id || command.id;
            let data = await handler.get(id, context);
            return data;
        },

        /**
         * Removes a model by its ID.
         *
         * @param {string} id - The ID of the model to remove.
         * @returns {Promise<Object>} The result of the removal operation.
         */
        remove: async (id) => {
            id = id || command.id;
            return handler.remove(id, context);
        },

        /**
         * Searches and retrieves a model based on a query.
         *
         * @param {string} query - The search query.
         * @returns {Promise<Object>} The retrieved model based on the search query.
         */
        "search-get": async (query) => {
            query = query || command.query;
            let data = await handler.search(query, context);
            let result = await handler.get(data, context);
            return result;
        },

        /**
         * Retrieves a model, updates it if it exists, or creates it if it does not.
         *
         * @param {Object} model - The model to retrieve or create.
         * @returns {Promise<Object>} The updated or created model.
         */
        "get-put-post": async (model) => {
            let id = command.id;
            let data = await handler.get(id, context);
            if (data.isSuccess === true) {
                model = model || command.model || {};
                id = model.id || command.id;
                return handler.update(id, model, context);
            } else {
                model = model || command.model;
                return handler.create(model, context);
            }
        }
    };
};
