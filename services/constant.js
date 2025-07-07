
const file = require('../helpers/file');
const context = require('../services/context');

let _transforms = {};
let _inputs = {};
let _errors = {};
let _actions = {};

const init = () => {

    _errors = {};
    _inputs = {};
    _actions = {};
    _transforms = {};

    const transforms = file.read({
        folder: '$data',
        file: 'transforms.json'
    })
    const inputs = file.read({
        folder: '$data',
        file: 'inputs.json'
    })
    const errors = file.read({
        folder: '$data',
        file: 'errors.json'
    })
    const actions = file.read({
        folder: '$data',
        file: 'actions.json'
    })


    transforms.items.forEach((item) => {
        _transforms[item.code.toLowerCase()] = item.ref ? _errors[item.ref] : item;
    });

    _transforms._all = transforms.items;


    errors.items.forEach((item) => {
        _errors[item.code.toLowerCase()] = item.ref ? _errors[item.ref] : item;
    });

    _errors._all = errors.items;

    actions.items.forEach((item) => {
        _actions[item.code.toLowerCase()] = item.ref ? _actions[item.ref] : item;
    });
    _actions._all = actions.items;


    inputs.items.forEach((item) => {
        _inputs[item.code.toLowerCase()] = item.ref ? _inputs[item.ref] : item;
    });
    _inputs._all = inputs.items;

}

init();

exports.errors = {
    get: (code) => {
        if (!code) return;
        return _errors[code.toLowerCase()];
    },
    search: () => {
        return _errors._all;
    }
}


exports.transforms = {
    get: (code) => {
        if (!code) return;
        return _transforms[code.toLowerCase()];
    },
    search: () => {
        return _transforms._all;
    }
}

exports.actions = {
    get: (code) => {
        if (!code) return;
        return _actions[code.toLowerCase()];
    },

    search: () => {
        return _actions._all;
    }
}

exports.inputs = {
    get: (code) => {
        if (!code) return;
        return _inputs[code.toLowerCase()];
    },

    search: () => {
        return _inputs._all;
    }
}


exports.endpoints = {
    get: (code) => {
        if (!code) return;

        // let endpoints = file.read({ folder: [folder, 'endpoints'], file: `${code}.json` })
        // if (!endpoints) {
        endpoints = [];
        const specs = context.services.get(code).specs
        //  file.read({ folder: [folder, 'specs'], file: `${code}.json` })
        const paths = specs.paths;

        // Loop through each path
        for (const path in paths) {
            if (!paths.hasOwnProperty(path)) {
                continue
            }
            const methods = paths[path];

            // Loop through each method in the path
            for (const method in methods) {
                if (!methods.hasOwnProperty(method)) {
                    continue
                }
                const methodDetails = methods[method];
                let collection = path.split('/').filter(i => i !== '')[0]
                endpoints.push({
                    name: `${methodDetails.summary} ${collection}`,
                    value: {
                        collection: collection,
                        type: methodDetails.summary,
                        method: method,
                        path: path,
                        permissions: methodDetails.permissions || [],
                    }
                });
            }
        }

        //     file.write({ folder: [folder, 'endpoints'], file: `${code}.json` }, endpoints)
        // }

        // Display result

        context.hasPermission()

        endpoints = endpoints.filter(e => context.hasPermission(e.value.permissions))
        return endpoints
    }
}