const axios = require('axios');

/**
 * Creates an instance of HttpClient to manage HTTP requests.
 *
 * @class
 */
class HttpClient {
    /**
     * Initializes the HttpClient with a base URL and timeout.
     *
     * @param {string} [baseURL=''] - The base URL for the HTTP client.
     */
    constructor(baseURL = '') {
        this.client = axios.create({
            baseURL,
            timeout: 5000, // You can adjust the timeout as needed
        });
    }

    /**
     * Sends a GET request to the specified URL with optional parameters and headers.
     *
     * @param {string} url - The URL to send the GET request to.
     * @param {Object} options - Optional parameters including headers and query parameters.
     * @returns {Promise<Object>} The response data from the GET request.
     */
    async get(url, options) {
        try {
            const response = await this.client.get(url, {
                params: options.params || {},
                headers: options.headers || {},
            });
            return response.data;
        } catch (error) {
            if (options.fallback) {
                return options.fallback();
            } else {
                this.handleError(error);
            }
        }
    }

    /**
     * Handles errors that occur during HTTP requests.
     *
     * @param {Object} error - The error object thrown during the request.
     */
    handleError(error) {
        if (error.response) {
            console.error(`HTTP error: ${error.response.status} - ${error.response.statusText}`);
            console.error(`Response data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Request setup error:', error.message);
        }

        throw error; // Re-throwing the error allows handling it further up if needed
    }
}

module.exports = HttpClient;
