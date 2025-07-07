const inquirer = require('inquirer');
const chalk = require('chalk');
const jsonfile = require('jsonfile');

inquirer.registerPrompt('file', require('inquirer-fuzzy-path'));
inquirer.registerPrompt('directory', require('inquirer-select-directory'));

/**
 * Prompts the user to select a command from a list of choices.
 *
 * @param {string} name - The name of the command to display.
 * @param {Array<string>} choices - The list of choices for the user to select from.
 * @returns {Promise<string|undefined>} The selected command or undefined if quit.
 */
exports.get = async (name, choices) => {
    console.log(chalk.blue(`starting ${name || ''}`));

    const options = choices.map(choice => ({ name: choice }));
    options.push({ name: 'quit' });

    let params = await inquirer.prompt([{
        type: 'list',
        name: 'cmd',
        choices: options,
        message: 'select one',
        validate: (value) => {
            return value.length ? true : 'invalid choice';
        }
    }]);

    if (params.cmd === 'quit') {
        console.log(chalk.blue(`quitting ${name || ''}`));
        return;
    }

    console.log(chalk.blue(`executing ${name || ''}:${params.cmd}`));

    return params.cmd;
};

/**
 * Prompts the user to input an ID.
 *
 * @returns {Promise<string>} The entered ID.
 */
exports.getId = async () => {
    let params = await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'id:',
        validate: (value) => {
            return value.length ? true : 'invalid id';
        }
    }]);

    return params.id;
};

/**
 * Prompts the user to input text.
 *
 * @param {string} message - The message to display to the user.
 * @param {boolean} required - Whether the input is required.
 * @returns {Promise<string>} The entered text.
 */
exports.getText = async (message, required) => {
    let params = await inquirer.prompt([{
        type: 'input',
        name: 'value',
        message: message,
        validate: (value) => {
            return required && !value.length ? 'This field is required.' : true;
        }
    }]);

    return params.value;
};

/**
 * Prompts the user to select a file path.
 *
 * @returns {Promise<string>} The selected file path.
 */
exports.getPath = async () => {
    let params = await inquirer.prompt([{
        type: 'directory',
        basePath: process.cwd(),
        name: 'dir',
        message: 'select folder',
    }]);

    params = await inquirer.prompt([{
        type: 'file',
        rootPath: params.dir,
        name: 'path',
        message: 'select file'
    }]);
    return params.path;
};

/**
 * Prompts the user to input a query.
 *
 * @param {Array<string|Object>} keys - The list of keys for the query.
 * @returns {Promise<Object>} The entered query.
 */
exports.getQuery = async (keys) => {
    let query = {};
    if (!keys || !keys.length) {
        return query;
    }

    let prompts = keys.map(key => {
        if (typeof key === 'string') {
            return { name: key };
        } else {
            return key;
        }
    });

    let addToQuery = async () => {
        let options = [];
        prompts.forEach(key => {
            options.push({
                name: key.name,
                action: async () => {
                    let prompt = {
                        type: 'input',
                        name: 'value',
                        message: 'value:'
                    };

                    if (key.choices && key.choices.length) {
                        prompt.type = 'list';
                        prompt.choices = key.choices;
                    }

                    let params = await inquirer.prompt([prompt]);

                    if (params.value) {
                        query[key.name] = params.value;
                    }
                    prompts = prompts.filter(k => key.name !== k.name);
                    if (prompts.length) {
                        return addToQuery();
                    }
                }
            });
        });

        return this.operations('select key', options);
    };

    await addToQuery();
    return query;
};

/**
 * Inflates a flattened object into a nested object.
 *
 * @param {Object} flattened - The flattened object.
 * @returns {Object} The inflated object.
 */
const inflate = (flattened) => {
    let model = {};

    Object.getOwnPropertyNames(flattened).forEach(key => {
        const value = flattened[key];

        if (!value) {
            return;
        }

        let parts = key.split('.');
        let index = 0;
        let obj = model;

        for (const part of parts) {
            if (index === parts.length - 1) {
                obj[part] = value;
            } else {
                obj[part] = obj[part] || {};
            }

            obj = obj[part];
            index++;
        }
    });

    return model;
};

/**
 * Prompts the user to select a model.
 *
 * @param {Array<string>} keys - The list of keys for the model.
 * @returns {Promise<Object>} The selected model.
 */
exports.getModel = async (keys) => {
    return this.operations('get by', [{
        name: 'json-file',
        action: async () => {
            let path = await this.getPath();
            return jsonfile.readFileSync(path);
        }
    }, {
        name: 'manually',
        action: async () => {
            let flattened = await this.getQuery(keys);
            return inflate(flattened);
        }
    }]);
};

/**
 * Prompts the user to select an operation.
 *
 * @param {string} name - The name of the operation.
 * @param {Array<Object>} choices - The list of choices for the operation.
 * @param {Object} options - The options for the operation.
 * @returns {Promise<*>} The result of the operation.
 */
exports.operations = async (name, choices, options) => {
    options = options || {};
    let title = options.title || `operations on ${name || ''}`;
    console.log(chalk.blue(title));

    choices = choices || [];

    const listOptions = [];

    choices.forEach(choice => {
        listOptions.push({
            name: choice.name
        });
    });

    let quitName = options.quit || 'quit';

    listOptions.push({
        name: quitName
    });

    let params = await inquirer.prompt([{
        type: 'list',
        name: 'cmd',
        choices: listOptions,
        message: 'select one',
        validate: (value) => {
            return value.length ? true : 'invalid choice';
        }
    }]);

    if (params.cmd === quitName) {
        return;
    }

    console.log(chalk.blue(`executing ${name || ''}:${params.cmd}`));

    let choice = choices.find(c => c.name === params.cmd);

    return choice.action();
};