const fs = require('fs');
const client = require('@open-age/client');

/**
 * Processes a specific JSON file in a specified directory and executes a command based on its content.
 *
 * @param {Object} command - The command object containing configuration and folder information.
 * @param {Object} context - The context for executing the command.
 * @returns {*} The result of the executed command.
 */
module.exports = (command, context) => {
    const dirPath = `${command.config.root}/${command.folder}`;

    let fileData = JSON.parse(fs.readFileSync(`${dirPath}/${command.config.file}`, 'utf8'));
    let handler = client[fileData.service][fileData.collection];

    if (!fileData.method) {
        return 'operation not specified';
    }

    const result = handler[fileData.method](fileData.data, context);
    return result;
};