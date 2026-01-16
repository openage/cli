import fs from 'fs'
import * as context from '../../src/providers/context.js'
import * as pathModule from 'path'
import logger from './logger.js'

const _readFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return
    }
    const data = fs.readFileSync(filePath, 'utf-8')

    if (filePath.toLowerCase().endsWith('.json')) {
        return JSON.parse(data)
    }

    return data
}

const _readFolder = (folder) => {
    if (!fs.existsSync(folder)) {
        return
    }

    let dataArray = []

    // Read all file names in the folder
    const files = fs.readdirSync(folder)

    for (const file of files) {
        if (file.startsWith('.') || file.startsWith('_')) {
            continue
        }
        const filePath = pathModule.join(folder, file)
        let data = _readFile(filePath)
        dataArray.push(data)
    }

    return dataArray
}

const _setRoot = (uri) => {
    if (!uri || uri === '.') {
        uri = '$cwd'
    }

    // Define replacements for root paths
    const paths = context.paths()

    // Perform replacement using the map
    for (const [key, value] of Object.entries(paths)) {
        if (uri.startsWith(key)) {
            uri = pathModule.join(value, uri.replace(key, ''))
            // uri = uri.replace(key, value);
            break // Exit loop once the first match is found and replaced
        }
    }

    // Handle relative paths starting with './'
    if (uri.startsWith('./')) {
        uri = pathModule.join(paths.$cwd, uri.slice(2))
    }

    // Ensure the URI is absolute
    if (!pathModule.isAbsolute(uri)) {
        uri = pathModule.join(paths.$cwd, uri)
    }

    return uri
}

const _parse = (config) => {
    if (typeof config === 'string') {
        config = _setRoot(config)
        if (pathModule.extname(config)) {
            config = { file: config }
        } else {
            config = { folder: config }
        }
    } else if (config.config) {
        config = config.config
    }

    let file
    let folder
    if (config.file) {
        file = pathModule.basename(config.file) // Extracts the file name
        folder = pathModule.dirname(config.file) // Extracts the folder path
    }

    if (config.folder) {
        folder = config.folder
    }

    if (Array.isArray(folder)) {
        folder = pathModule.join(...folder)
    }

    folder = _setRoot(folder)

    let parsed = {
        folder: folder,
        file: file,
        format: config.format || 'json'
    }

    // if (parsed.file) {
    //     parsed.file = path.join(parsed.folder, parsed.file)
    // }

    return parsed
}

const _getAllFiles = (dirPath, options, arrayOfFiles = []) => {
    options = options || {}
    options.exclude = options.exclude || {}
    options.include = options.include || {}
    options.exclude.folders = options.exclude.folders || []
    options.include.files = options.include.files || []
    const files = fs.readdirSync(dirPath)

    for (const file of files) {
        const filePath = pathModule.join(dirPath, file)
        if (fs.statSync(filePath).isDirectory()) {
            if (options.exclude.folders.length && options.exclude.folders.find(f => filePath.endsWith(f))) {
                continue
            }
            // Recursively add files from the subdirectory
            _getAllFiles(filePath, options, arrayOfFiles)
        } else {

            if (options.include.files.length && !options.include.files.find(f => filePath.endsWith(f))) {
                continue
            }
            // Add file to the array
            arrayOfFiles.push(filePath)
        }
    }
    return arrayOfFiles
}

const _ensureDir = folder => {
    if (fs.existsSync(folder)) {
        return
    }

    const separator = pathModule.sep

    const parts = folder.split(separator)

    const parent = parts.slice(0, parts.length - 1).join(separator)

    _ensureDir(parent)

    fs.mkdirSync(folder)
}

const _sanitize = (filePath) => {
    const dir = pathModule.dirname(filePath) // Extract directory
    const fileName = pathModule.basename(filePath) // Extract file name

    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '_') // Sanitize file name
    return pathModule.join(dir, sanitizedFileName) // Recombine sanitized file name with directory
}

export const remove = (config) => {
    config = _parse(config)

    function removeAllFilesAndFolders(directoryPath) {
        if (fs.existsSync(directoryPath)) {
            // Read all files and directories within the given directory
            fs.readdirSync(directoryPath).forEach((file) => {
                const currentPath = pathModule.join(directoryPath, file)

                // Check if it's a directory or file
                if (fs.lstatSync(currentPath).isDirectory()) {
                    // Recursive call if directory
                    removeAllFilesAndFolders(currentPath)
                    // Remove the empty directory
                    fs.rmdirSync(currentPath)
                } else {
                    // Delete file
                    fs.unlinkSync(currentPath)
                }
            })
        }
    }

    if (config.file) {
        if (fs.existsSync(config.file)) {
            fs.unlinkSync(config.file)
        }

    } else if (config.folder) {
        removeAllFilesAndFolders(config.folder)
    }

}

export const read = (config) => {

    config = _parse(config)

    if (!config.file) {
        return _readFolder(config.folder)
    } else {
        const filePath = pathModule.join(config.folder, config.file)
        return _readFile(filePath)
    }
}

export const path = (config) => {
    config = _parse(config)
    if (config.file) {
        return pathModule.join(config.folder, config.file)
    }

    return config.folder
}

export const meta = (key, config, data) => {
    config = _parse(config)

    const relativePath = pathModule.relative(context.paths('$content'), config.folder)
    const folderPath = pathModule.join(context.paths('$meta'), relativePath)

    let filePath

    let file = config.file

    if (file) {

        filePath = pathModule.join(folderPath, file)
        if (!fs.existsSync(filePath)) {
            filePath = pathModule.join(folderPath, `${key}.json`)
            file = undefined
        }
    } else {
        filePath = pathModule.join(folderPath, `${key}.json`)
    }
    _ensureDir(folderPath)

    if (!data) {
        const meta = _readFile(filePath) || {}

        if (file) {
            return meta[key]
        }

        return meta
    } else {
        // for (const key in data) {
        //     if (!Object.prototype.hasOwnProperty.call(data, key)) {
        //         continue;
        //     }
        //     if (key === 'items') {
        //         for (const key in data.items) {
        //             if (Object.prototype.hasOwnProperty.call(data.items, key)) {
        //                 meta.items[key] = data.items[key];
        //             }
        //         }
        //     } else {
        //         meta[key] = data[key];
        //     }
        // }

        const jsonData = JSON.stringify(data, null, 2)
        fs.writeFileSync(filePath, jsonData, 'utf8')
        return data
    }

    // if (config.file) {
    //     let content = _readFile(config.file)
    //     return content.meta || {};
    // } else {
    //     const filePath = pathModule.join(config.folder, '.oa')
    //     return this.exists(filePath) ? _readFile(pathModule.join(config.folder, '.oa')) : {}
    // }
}

export const write = (config, data, options) => {
    config = _parse(config)

    _ensureDir(config.folder)

    if (!config.file) {
        config.file = `${data.code || data.id}.${config.format}`
    }

    let filePath = pathModule.join(config.folder, config.file)
    filePath = _sanitize(filePath)

    options = options || {}
    options.encoding = options.encoding || 'utf8'

    switch (config.format) {
        case 'json': {
            const jsonData = JSON.stringify(data, null, 2)
            fs.writeFileSync(filePath, jsonData, options)
            break
        }
        default:
            fs.writeFileSync(filePath, data, options)
            break
    }

    logger('helpers.file').debug(`Created file ${filePath}`)
    return filePath
}

export const append = (config, data, options) => {
    config = _parse(config)
    const log = logger('helpers.file')

    _ensureDir(config.folder)

    if (!config.file) {
        const file = `${data.code || data.id}.${config.format}`
        config.file = pathModule.join(config.folder, file)
    }

    options = options || {}
    options.encoding = 'utf8'

    const filePath = _sanitize(config.file)

    switch (config.format) {
        case 'json': {
            const jsonData = JSON.stringify(data, null, 2)
            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, jsonData, options)
                log.debug(`Updated file ${filePath}`)
            } else {
                fs.writeFileSync(filePath, jsonData, options)
                log.debug(`Created file ${filePath}`)
            }

            return filePath
        }
        default:
            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, data, options)
                log.debug(`Updated file ${filePath}`)
            } else {
                fs.writeFileSync(filePath, data, options)
                log.debug(`Created file ${filePath}`)
            }
    }

    return filePath
}

export const isPath = (val) => {
    if (typeof val !== 'string') return false

    const ext = pathModule.extname(val)
    const hasSlash = val.includes('/') || val.includes('\\')

    return ext || hasSlash
}

export const exists = (config) => {

    config = _parse(config)

    if (!config.file) {
        return fs.existsSync(config.folder)
    } else {
        let filePath = config.folder ? pathModule.join(config.folder, config.file) : config.file
        filePath = _sanitize(filePath)
        return fs.existsSync(filePath)
    }
}

export const parse = (param) => {
    if (!param) return
    // if (param.endsWith('.json') && !param.startsWith('file://')) {
    //     param = `file://${param}`
    // } else if (!param.endsWith('.json') && !param.startsWith('folder://')) {
    //     param = `folder://${param}`
    // }

    return _parse(param)

    // return param
}

export const find = (config, options) => {

    config = _parse(config)
    let exists = false

    let file = config.file
    let folder = config.folder

    if (file) {
        let filePath = pathModule.join(folder, file)
        if (!fs.existsSync(filePath)) {
            if (options.include?.folders?.length) {

                let relativePath = folder.replace(context.paths('$cwd'), '')

                for (const code of options.include.folders) {
                    folder = pathModule.join(context.paths(code), relativePath)
                    filePath = pathModule.join(folder, file)
                    if (fs.existsSync(filePath)) {
                        exists = true
                        break
                    }
                }
            }
        } else {
            exists = true
        }
        if (exists) return [filePath]
    }

    if (folder) {
        if (!fs.existsSync(folder)) {
            if (options.include?.folders?.length) {
                let relativePath = folder.replace(context.paths('$cwd'), '')

                for (const code of options.include.folders) {
                    folder = pathModule.join(context.paths(code), relativePath)
                    if (fs.existsSync(folder)) {
                        exists = true
                        break
                    }
                }
            }
        } else {
            exists = true
        }
        if (exists) return _getAllFiles(folder, options)
    }
    return []
}
