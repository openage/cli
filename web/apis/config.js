import { readJsonBody, sendJson } from './common.js'

const parseConfigValue = (value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (trimmed.toLowerCase() === 'true') return true
    if (trimmed.toLowerCase() === 'false') return false
    if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed)
    return trimmed
}

export const handleConfigApi = ({ req, res, configFolder, executeCliCommand, settings, logger }) => {
    if (!(req.url && req.url.startsWith('/api/config'))) {
        return false
    }

    if (req.method === 'GET') {
        executeCliCommand('oa config', configFolder)
            .then((commandResult) => {
                sendJson(res, 200, {
                    ok: true,
                    command: 'oa config',
                    output: commandResult.stdout || '',
                    error: commandResult.stderr || '',
                    code: commandResult.code,
                    data: settings.get(null, { decrypt: false }) || {}
                })
            })
            .catch((error) => {
                logger('handlers.serve').error(error)
                sendJson(res, 500, { ok: false, error: 'Unable to load config.' })
            })
        return true
    }

    if (req.method === 'POST') {
        readJsonBody(req)
            .then(async (payload) => {
                const key = String(payload.key || '').trim()
                if (!key) {
                    sendJson(res, 400, { ok: false, error: 'Config key is required.' })
                    return
                }

                settings.set(key, parseConfigValue(payload.value), { encrypt: Boolean(payload.encrypt) })
                const currentValue = settings.get(key, { decrypt: false })
                const commandResult = await executeCliCommand(`oa config ${key}`, configFolder)

                sendJson(res, 200, {
                    ok: true,
                    key,
                    value: currentValue,
                    command: `oa config ${key}`,
                    output: commandResult.stdout || '',
                    error: commandResult.stderr || '',
                    code: commandResult.code,
                    data: settings.get(null, { decrypt: false }) || {}
                })
            })
            .catch((error) => {
                logger('handlers.serve').error(error)
                sendJson(res, 400, { ok: false, error: 'Invalid request body.' })
            })
        return true
    }

    return false
}
