const fs = require('fs')
const path = require('path')
const logger = require('./logger')

const _root = () => {
    let cwd = process.env.OA_CWD || process.cwd()
    return {
        app: require('app-root-path').path,
        data: path.join(require('app-root-path').path, 'data'),
        cwd: cwd,
        cache: path.join(cwd, '.cache'),
        logs: path.join(cwd, '.logs'),
        scripts: path.join(cwd, '.scripts'),
        settings: path.join(cwd, '.settings'),
    }
}

const context = require('../services/context')

const _readFile = (filePath) => {
    if (!fs.existsSync(filePath)) {
        return
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data)
}

const _readFolder = (folder) => {
    if (!fs.existsSync(folder)) {
        return
    }

    let dataArray = [];

    // Read all file names in the folder
    const files = fs.readdirSync(folder);

    for (const file of files) {
        if (folder.startsWith('.') || folder.startsWith('_')) {
            continue;
        }
        const filePath = path.join(folder, file)
        let data = _readFile(filePath)
        dataArray.push(data)
    }

    return dataArray
}

const _setRoot = (uri) => {
    if (!uri || uri === '.') {
        uri = '$cwd';
    }

    const root = _root();

    // Define replacements for root paths
    const rootPaths = {
        '$app': root.app,
        '$data': root.data,
        '$cwd': root.cwd,
        '$cache': root.cache,
        '$logs': root.logs,
        '$scripts': root.scripts,
        '$settings': root.settings
    };

    // Perform replacement using the map
    for (const [key, value] of Object.entries(rootPaths)) {
        if (uri.startsWith(key)) {
            uri = uri.replace(key, value);
            break; // Exit loop once the first match is found and replaced
        }
    }

    // Handle relative paths starting with './'
    if (uri.startsWith('./')) {
        uri = path.join(root.cwd, uri.slice(2));
    }

    // Ensure the URI is absolute
    if (!path.isAbsolute(uri)) {
        uri = path.join(root.cwd, uri);
    }

    return uri;
};


const _parse = (config) => {
    if (typeof config === 'string') {
        config = _setRoot(config)
        if (path.extname(config)) {
            config = { file: config }
        } else {
            config = { folder: config }
        }
    }
    let file
    let folder
    if (config.file) {
        file = path.basename(config.file); // Extracts the file name
        folder = path.dirname(config.file); // Extracts the folder path
    }

    if (config.folder) {
        folder = config.folder
    }

    if (Array.isArray(folder)) {
        folder = path.join(...folder)
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
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (options.exclude.folders.length && options.exclude.folders.find(f => filePath.endsWith(f))) {
                continue;
            }
            // Recursively add files from the subdirectory
            _getAllFiles(filePath, options, arrayOfFiles);
        } else {

            if (options.include.files.length && !options.include.files.find(f => filePath.endsWith(f))) {
                continue
            }
            // Add file to the array
            arrayOfFiles.push(filePath);
        }
    }
    return arrayOfFiles;
}

const _ensureDir = folder => {
    if (fs.existsSync(folder)) {
        return
    }

    const separator = path.sep;

    const parts = folder.split(separator)

    const parent = parts.slice(0, parts.length - 1).join(separator)

    _ensureDir(parent)

    fs.mkdirSync(folder)
}

const _sanitize = (filePath) => {
    const dir = path.dirname(filePath); // Extract directory
    const fileName = path.basename(filePath); // Extract file name
    const sanitizedFileName = fileName.replace(/[<>:"\/\\|?*]/g, '_'); // Sanitize file name
    return path.join(dir, sanitizedFileName); // Recombine sanitized file name with directory
}

exports.cwd = () => {
    const root = _root()
    if (root.cwd !== root.app) {
        return root.cwd;
    }
}

exports.remove = (config) => {
    config = _parse(config)

    function removeAllFilesAndFolders(directoryPath) {
        if (fs.existsSync(directoryPath)) {
            // Read all files and directories within the given directory
            fs.readdirSync(directoryPath).forEach((file) => {
                const currentPath = path.join(directoryPath, file);

                // Check if it's a directory or file
                if (fs.lstatSync(currentPath).isDirectory()) {
                    // Recursive call if directory
                    removeAllFilesAndFolders(currentPath);
                    // Remove the empty directory
                    fs.rmdirSync(currentPath);
                } else {
                    // Delete file
                    fs.unlinkSync(currentPath);
                }
            });
        }
    }

    if (config.file) {
        if (fs.existsSync(config.file)) {
            fs.unlinkSync(config.file);
        }

    } else if (config.folder) {
        removeAllFilesAndFolders(config.folder);
    }

}


exports.read = (config) => {

    config = _parse(config)

    if (!config.file) {
        return _readFolder(folder)
    } else {
        const filePath = path.join(config.folder, config.file)
        return _readFile(filePath)
    }
}

exports.meta = (key, config, data) => {
    config = _parse(config)

    const filePath = config.file
        ? path.join(config.folder, '.oa', config.file)
        : path.join(config.folder, '.oa', `${key}.json`)

    if (!data) {
        const meta = _readFile(filePath) || {}

        if (!config.file) {
            return meta;
        }

        if (key) {
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

        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, jsonData, 'utf8');
        return data;
    }


    // if (config.file) {
    //     let content = _readFile(config.file)
    //     return content.meta || {};
    // } else {
    //     const filePath = path.join(config.folder, '.oa')
    //     return this.exists(filePath) ? _readFile(path.join(config.folder, '.oa')) : {}
    // }
}

exports.write = (config, data) => {
    config = _parse(config)

    _ensureDir(config.folder)

    if (!config.file) {
        config.file = `${data.code || data.id}.${config.format}`
    }

    /* eslint-disable*/
    switch (config.format) {
        case 'json':
            const jsonData = JSON.stringify(data, null, 2);
            let filePath = path.join(config.folder, config.file)
            filePath = _sanitize(filePath)
            fs.writeFileSync(filePath, jsonData, 'utf8')
            logger.debug(`Created file ${filePath}`)
            return filePath
        default:
            throw new Error(`Format ${config.format} is not supported`)
    }
    /* eslint-enable*/
}


exports.append = (config, data) => {
    config = _parse(config)

    _ensureDir(config.folder)

    if (!config.file) {
        const file = `${data.code || data.id}.${config.format}`
        config.file = path.join(config.folder, file);
    }

    /* eslint-disable*/
    switch (config.format) {
        case 'json':
            const jsonData = JSON.stringify(data, null, 2);
            const filePath = _sanitize(config.file)
            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, jsonData, 'utf8')
                logger.debug(`Updated file ${filePath}`)

            } else {
                fs.writeFileSync(filePath, jsonData, 'utf8')
                logger.debug(`Created file ${filePath}`)
            }

            return filePath
        default:
            throw new Error(`Format ${config.format} is not supported`)
    }
    /* eslint-enable*/
}


exports.exists = (config) => {

    config = _parse(config)

    if (!config.file) {
        return fs.existsSync(config.folder)
    } else {
        const filePath = _sanitize(config.file)
        return fs.existsSync(filePath)
    }
}

exports.parse = (param) => {
    if (!param) return;
    // if (param.endsWith('.json') && !param.startsWith('file://')) {
    //     param = `file://${param}`
    // } else if (!param.endsWith('.json') && !param.startsWith('folder://')) {
    //     param = `folder://${param}`
    // }

    return _parse(param)

    // return param
}



exports.get = (config, options) => {

    config = _parse(config)

    if (config.file) {
        return [config.file]
    } else {
        return _getAllFiles(config.folder, options)
    }
}