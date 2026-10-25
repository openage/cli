import fs from 'fs'
import path from 'path'
import { sendJson } from './common.js'

const listLogFiles = (folder, files = []) => {
    if (!fs.existsSync(folder)) return files
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const target = path.join(folder, entry.name)
        if (entry.isDirectory()) listLogFiles(target, files)
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.log')) files.push(target)
    }
    return files
}

const logDateFromName = (name) => name.match(/\.(\d{4}-\d{2}-\d{2})\.log$/)?.[1] || ''
const isErrorEvent = (event) => /error|failed|blocked|conflict|deferred/i.test(String(event.action || ''))

const readEntries = (logRoot, workspaceRoot) => listLogFiles(logRoot).flatMap((logPath) => {
    const relativeLogPath = path.relative(workspaceRoot, logPath).replace(/\\/g, '/')
    const fileDate = logDateFromName(path.basename(logPath))
    let content
    try { content = fs.readFileSync(logPath, 'utf8') }
    catch (error) {
        return [{ at: '', date: fileDate, file: '', operation: 'log-read-error', errorType: 'log-read-error', message: error.message, logPath: relativeLogPath }]
    }
    return content.split(/\r?\n/).flatMap((line, index) => {
        if (!line.trim()) return []
        try {
            const event = JSON.parse(line)
            const operation = String(event.action || 'unknown')
            return [{
                ...event,
                at: String(event.at || ''),
                date: fileDate || String(event.at || '').slice(0, 10),
                file: String(event.file || ''),
                operation,
                errorType: String(event.errorType || (isErrorEvent(event) ? event.reason || operation : '')),
                logPath: relativeLogPath
            }]
        } catch (error) {
            return [{
                at: '', date: fileDate, file: '', operation: 'log-parse-error', errorType: 'malformed-log-line',
                message: `Line ${index + 1}: ${error.message}`, raw: line, logPath: relativeLogPath
            }]
        }
    })
})

export const handleMonitLogsApi = ({ req, res, port, file }) => {
    const requestUrl = new URL(req.url || '/', `http://localhost:${port}`)
    if (requestUrl.pathname !== '/api/monit/logs' || req.method !== 'GET') return false

    try {
        const logRoot = path.resolve(file.path('$cwd'), '.logs')
        const allEntries = readEntries(logRoot, file.path('$cwd'))
        const dates = [...new Set(allEntries.map((entry) => entry.date).filter(Boolean))].sort().reverse()
        const files = [...new Set(allEntries.map((entry) => entry.file).filter(Boolean))].sort((a, b) => a.localeCompare(b))
        const operations = [...new Set(allEntries.map((entry) => entry.operation).filter(Boolean))].sort()
        const errorTypes = [...new Set(allEntries.map((entry) => entry.errorType).filter(Boolean))].sort()

        const dateFilter = requestUrl.searchParams.get('date') || ''
        const fileFilter = (requestUrl.searchParams.get('file') || '').trim().toLowerCase()
        const operationFilter = requestUrl.searchParams.get('operation') || ''
        const errorFilter = requestUrl.searchParams.get('errorType') || ''
        const search = (requestUrl.searchParams.get('search') || '').trim().toLowerCase()
        const filtered = allEntries.filter((entry) => {
            if (dateFilter && entry.date !== dateFilter) return false
            if (fileFilter && !entry.file.toLowerCase().includes(fileFilter)) return false
            if (operationFilter && entry.operation !== operationFilter) return false
            if (errorFilter && entry.errorType !== errorFilter) return false
            if (search && !JSON.stringify(entry).toLowerCase().includes(search)) return false
            return true
        }).sort((a, b) => String(b.at).localeCompare(String(a.at)))

        const pageSize = Math.min(500, Math.max(1, Number.parseInt(requestUrl.searchParams.get('pageSize') || '100', 10) || 100))
        const page = Math.max(0, Number.parseInt(requestUrl.searchParams.get('page') || '0', 10) || 0)
        const start = page * pageSize
        sendJson(res, 200, {
            ok: true,
            entries: filtered.slice(start, start + pageSize),
            total: filtered.length,
            page,
            pageSize,
            dates,
            files,
            operations,
            errorTypes
        })
    } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message || 'Unable to read monitor logs.' })
    }
    return true
}
