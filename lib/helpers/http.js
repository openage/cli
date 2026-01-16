import axios from 'axios'
import buildUrl from 'build-url'
import logger from './logger.js'

export const execute = async (req, context) => {
    const log = logger('helpers.http')
    let url = buildUrl(req.url, {
        path: req.path,
        queryParams: req.query && Object.getOwnPropertyNames(req.query).length !== 0 ? req.query : undefined
    })

    const match = url.match(/\$\{([a-zA-Z0-9_.-]+)\}/)
    let serviceCode = match ? match[1] : null

    if (serviceCode) {
        const serviceUrl = context.services.get(serviceCode)?.url
        url = url.replace(`:${serviceCode}`, serviceUrl).replace('${' + serviceCode + '}', serviceUrl)
    }

    log.debug(`${'req.method'.toUpperCase()}: ${url}`)

    const request = {
        method: req.method.toLowerCase(),
        url: url,
        headers: req.headers,
        data: req.data || req.body
    }

    log.debug('helpers/http:execute', request)
    const start = process.hrtime.bigint()

    try {
        const response = await axios(request)
        // 🕒 Calculate duration in milliseconds
        const end = process.hrtime.bigint()
        const durationMs = Number(end - start) / 1000000

        let data = response.data
        let isSuccess = data?.isSuccess
        if (isSuccess === true) {

            if (data.items) {
                data = {
                    skip: (data.pageNo - 1) * data.pageSize,
                    take: data.pageSize,
                    total: data.total,
                    items: data.items
                }
            } else {
                data = data.data
            }
        } else if (isSuccess === false) {
            const err = new Error(data.message || 'Request Failed', {
                cause: {
                    details: {
                        status: response?.status,
                        statusText: response?.statusText,
                        url: url,
                        method: req.method,
                        headers: response?.headers,
                        duration: durationMs,
                        data: data,
                    }
                }
            })

            throw err
        }

        return {
            status: response.status,
            statusText: response.statusText,
            url: url,
            method: req.method,
            headers: response.headers,
            duration: durationMs,
            data: data
        }
    } catch (error) {
        const end = process.hrtime.bigint()
        const durationMs = Number(end - start) / 1000000

        const err = new Error(error.message || 'Request failed', {
            cause: {
                details: {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    headers: error.response?.headers,
                    duration: durationMs,
                    data: error.response?.data,
                }
            }
        })

        throw err
    }
}
