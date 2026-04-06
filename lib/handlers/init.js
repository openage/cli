import fs from 'fs'
import pathModule from 'path'
import { fileURLToPath } from 'url'
import * as input from '../helpers/input.js'
import { deepMerge } from '../helpers/data.js'
import { execSync } from 'child_process'
import logger from '../helpers/logger.js'

/**
 * Initializes a new project structure by copying from a setup template.
 * Sets up mandatory folders, default configuration files, and Git if needed.
 * 
 * @param {object} params - Command parameters.
 */
export const execute = async (params) => {
    const log = logger('handlers.init')
    const cwd = process.env.OA_CWD || process.cwd()
    
    // Resolve setup template path relative to this file
    const __dirname = pathModule.dirname(fileURLToPath(import.meta.url))
    const setupPath = pathModule.resolve(__dirname, '../../setup')
    
    const actions = []
    
    // 1. Check Git Status
    const gitDir = pathModule.join(cwd, '.git')
    const hasGit = fs.existsSync(gitDir)
    if (!hasGit) {
        actions.push('- Initialize Git repository (git init)')
    }
    
    // 2. Discover files in setup folder
    const toCopy = []
    const getAllFiles = (dirPath, relativeDir = '') => {
        const files = fs.readdirSync(dirPath)
        for (const file of files) {
            const fullPath = pathModule.join(dirPath, file)
            const relativePath = pathModule.join(relativeDir, file)
            const targetPath = pathModule.join(cwd, relativePath)
            
            if (fs.statSync(fullPath).isDirectory()) {
                if (!fs.existsSync(targetPath)) {
                    toCopy.push({ src: fullPath, dest: targetPath, type: 'dir', rel: relativePath })
                }
                getAllFiles(fullPath, relativePath)
            } else {
                if (!fs.existsSync(targetPath)) {
                    toCopy.push({ src: fullPath, dest: targetPath, type: 'file', rel: relativePath })
                } else if (file.toLowerCase().endsWith('.json')) {
                    toCopy.push({ src: fullPath, dest: targetPath, type: 'merge', rel: relativePath })
                }
            }
        }
    }
    
    if (fs.existsSync(setupPath)) {
        getAllFiles(setupPath)
    } else {
        log.error(`Setup template not found at ${setupPath}`)
    }
    
    // Check for secret key if not in setup
    const secretKeyPath = pathModule.join(cwd, '.oa/secret.key')
    if (!fs.existsSync(secretKeyPath)) {
        actions.push('- Create new security key: .oa/secret.key')
    }

    toCopy.forEach(item => {
        actions.push(`- Copy ${item.type === 'dir' ? 'directory' : 'file'}: ${item.rel}`)
    })
    
    actions.push('- Git stage and commit with message "oa init"')

    // 3. Summarize and Confirm
    if (actions.length === 0) {
        console.log('\x1b[32mProject is already fully initialized.\x1b[0m')
        return
    }
    
    console.log('\n\x1b[1mPlanned initialization actions:\x1b[0m')
    actions.forEach(a => console.log(a))
    console.log('')
    
    const proceed = await input.get('proceed')
    if (!proceed) {
        console.log('Initialization cancelled.')
        return
    }
    
    // 4. Git Init (if needed)
    if (!hasGit) {
        console.log('\x1b[36mInitializing Git...\x1b[0m')
        try {
            execSync('git init', { cwd, stdio: 'inherit' })
            const remote = await input.get('remote-origin')
            if (remote && remote.trim()) {
                execSync(`git remote add origin ${remote}`, { cwd, stdio: 'inherit' })
            }
        } catch (e) {
            log.error('Git initialization failed.', e)
        }
    }
    
    // 5. Execute Creation/Copy
    for (const item of toCopy) {
        try {
            if (item.type === 'dir') {
                fs.mkdirSync(item.dest, { recursive: true })
            } else if (item.type === 'merge') {
                const template = JSON.parse(fs.readFileSync(item.src, 'utf8'))
                const current = JSON.parse(fs.readFileSync(item.dest, 'utf8'))
                const merged = deepMerge(current, template)
                fs.writeFileSync(item.dest, JSON.stringify(merged, null, 2), 'utf8')
            } else {
                const dir = pathModule.dirname(item.dest)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                fs.copyFileSync(item.src, item.dest)
            }
        } catch (e) {
            log.error(`Failed to ${item.type === 'merge' ? 'merge' : 'copy'} ${item.rel}`, e)
        }
    }
    
    // Secret Key
    if (!fs.existsSync(secretKeyPath)) {
        const dir = pathModule.dirname(secretKeyPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(secretKeyPath, Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2), 'utf8')
    }
    
    // 6. Final Commit
    console.log('\x1b[36mCommitting initial files...\x1b[0m')
    try {
        execSync('git add .', { cwd, stdio: 'inherit' })
        execSync('git commit -m "oa init"', { cwd, stdio: 'inherit' })
    } catch (e) {
        log.warn('Git commit failed. You may need to commit manually.', e.message)
    }
    
    console.log('\n\x1b[32m✔ Project successfully initialized and committed.\x1b[0m\n')
}
