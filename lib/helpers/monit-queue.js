import fs from 'fs'
import path from 'path'

const taskPathKey = (value) => path.resolve(value || '').toLowerCase()
const taskPriority = (task) => task.status === 'awaiting-approval' ? 4 : task.status === 'processing' ? 3 : task.kind === 'push' && task.status === 'queued' ? 2 : 1

export const dedupePendingTasks = (pending = []) => {
    const byPath = new Map()
    for (const task of pending) {
        if (!task?.path) continue
        const key = taskPathKey(task.path)
        const previous = byPath.get(key)
        if (!previous || taskPriority(task) >= taskPriority(previous)) byPath.set(key, previous ? { ...previous, ...task, id: previous.id || task.id } : task)
    }
    return [...byPath.values()]
}

export const taskPathKeyForMonitor = taskPathKey

export const getMonitQueuePath = ({ workspaceRoot, metaRoot }) => {
    const queuePath = path.join(workspaceRoot, '.cache', 'monit', 'pending.json')
    const legacyPath = path.join(metaRoot, '.monit', 'pending.json')
    if (!fs.existsSync(queuePath) && fs.existsSync(legacyPath)) {
        fs.mkdirSync(path.dirname(queuePath), { recursive: true })
        try {
            fs.renameSync(legacyPath, queuePath)
        } catch (error) {
            if (error.code === 'EEXIST' && fs.existsSync(queuePath)) return queuePath
            throw error
        }
    }
    return queuePath
}
