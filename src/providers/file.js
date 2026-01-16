import * as fs from 'fs'

/**
 * Processes JSON files in a specified directory and executes commands based on their content.
 *
 * @param {Object} command - The command object containing configuration and folder information.
 * @param {Object} context - The context for executing the commands.
 * @returns {Array} An array of results from the executed commands.
 */
export default (command, context) => {
    const dirPath = `${command.config.root}/${command.folder}`

    let filenames = fs.readdirSync(dirPath)
    const files = filenames.filter(file => file.match(/.*\.json/i))
    const finalResult = []

    // files.forEach((file) => {
    //     let fileData = JSON.parse(fs.readFileSync(`${dirPath}/${file}`, 'utf8'))
    //     let handler = client[fileData.service][fileData.collection]

    //     if (!fileData.method) {
    //         return 'operation not specified'
    //     }

    //     const result = handler[fileData.method](fileData.data, context)
    //     finalResult.push(result)
    // })

    return finalResult
}
