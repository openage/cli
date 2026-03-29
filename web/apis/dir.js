import path from 'path'
import { sendJson } from './common.js'

export const handleDirApi = ({
    req,
    res,
    port,
    configFolder,
    fs,
    resolveApiDirectoryTarget,
    getGitStatusMap,
    toPosix,
    getMimeTypeForPath,
    toRelativePosix,
    file
}) => {
    if (!(req.url && req.url.startsWith('/api/dir') && req.method === 'GET')) {
        return false
    }

    const query = new URL(req.url, `http://localhost:${port}`).searchParams
    const subPath = query.get('path') || ''
    const target = resolveApiDirectoryTarget(configFolder, subPath)

    const folderStatusFromMap = (statusMap, normalizedPath) => {
        if (!normalizedPath) return 'clean'
        const prefix = `${normalizedPath}/`
        const statuses = Array.from(statusMap.entries())
            .filter(([candidate]) => candidate === normalizedPath || candidate.startsWith(prefix))
            .map(([, status]) => status)
        if (!statuses.length) return 'clean'
        if (statuses.includes('staged+modified')) return 'staged+modified'
        const hasModified = statuses.includes('modified')
        const hasStaged = statuses.includes('staged')
        if (hasModified && hasStaged) return 'staged+modified'
        if (hasModified) return 'modified'
        if (hasStaged) return 'staged'
        if (statuses.includes('untracked')) return 'untracked'
        return 'clean'
    }

    fs.readdir(target, { withFileTypes: true }, async (err, entries) => {
        if (err) {
            sendJson(res, 404, { error: 'Directory not found' })
            return
        }

        const statusMap = await getGitStatusMap(configFolder)
        const result = entries.map((entry) => {
            const entryType = entry.isDirectory() ? 'directory' : 'file'
            const relPath = subPath ? `${subPath}/${entry.name}` : entry.name
            const normalizedPath = toPosix(relPath)
            const absolutePath = path.join(target, entry.name)
            return {
                name: entry.name,
                path: normalizedPath,
                type: entryType,
                webPath: `/${normalizedPath.split('/').map((part) => encodeURIComponent(part)).join('/')}`,
                mimeType: entryType === 'directory' ? 'inode/directory' : getMimeTypeForPath(entry.name),
                gitStatus: entryType === 'directory'
                    ? folderStatusFromMap(statusMap, normalizedPath)
                    : (statusMap.get(normalizedPath) || 'clean'),
                cwdRelativePath: toRelativePosix(file.path('$cwd'), absolutePath)
            }
        })
        sendJson(res, 200, result)
    })

    return true
}
