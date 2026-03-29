export const readJsonBody = (req, maxLen = 200000) => new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
        body += chunk.toString()
        if (body.length > maxLen) {
            body = body.slice(0, maxLen)
        }
    })
    req.on('end', () => {
        try {
            resolve(JSON.parse(body || '{}'))
        } catch (error) {
            reject(error)
        }
    })
    req.on('error', (error) => reject(error))
})

export const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
}
