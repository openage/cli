import path from 'path'
let _context

export const set = context => {
    _context = context
}

export const get = () => {
    return _context
}

const cwd = () => {
    return process.env.OA_CWD = process.env.OA_CWD || process.cwd()
}

export const paths = (key = null) => {

    const root = cwd()

    let paths

    if (root) {
        paths = {
            '$cwd': root,
            '$content': path.join(root, 'data'),
            '$specs': path.join(root, 'specs'),
            '$scripts': path.join(root, 'scripts'),
            '$data': path.join(root, '.data'),
            '$oa': path.join(root, '.oa'),
            '$meta': path.join(root, '.oa', 'meta'),
            '$settings': path.join(root, '.oa', 'settings'),
            '$cache': path.join(root, '.cache') // _context?.storageUri
        }
    } else {
        paths = {}
    }

    if (key) {
        return paths[key]
    }

    return paths
}
