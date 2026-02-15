import * as inquirer from '@inquirer/prompts'
import * as context from './context.js'
import open from 'open'
import fs from 'node:fs'
import path from 'node:path'

export const input = async (message, options) => {
    options = options || {}
    const prompt = {
        message: message,
        default: options.default
    }

    if (options.check) {
        prompt.validate = text => {
            return options.check(text) || true
        }
    }

    return inquirer.input(prompt)

    // return vscode.window.showInputBox(prompt)
}

export const secret = async (message, options) => {
    options = options || {}
    const prompt = {
        message: message,
        mask: '*'
    }

    if (options.check) {
        prompt.validate = text => {
            return options.check(text) || true
        }
    }

    return inquirer.password(prompt)

    // return vscode.window.showInputBox(prompt)
}

export const file = async (message, filters) => {

    return inquirer.input({
        message: message || 'Enter file path',
        validate: (value) =>
            fs.existsSync(value) && fs.statSync(value).isFile()
                ? true
                : 'File does not exist',
    })
}

export const folder = async (message, filters) => {
    return inquirer.input({
        message: message || 'Select a folder',
        default: context.paths('$cwd'),
        validate: (value) => {
            const resolved = path.resolve(value)
            if (!fs.existsSync(resolved)) return 'Path does not exist'
            if (!fs.statSync(resolved).isDirectory()) return 'Not a directory'
            return true
        },
    })

    // const folderUri = await vscode.window.showOpenDialog({
    //     canSelectFiles: false,
    //     canSelectFolders: true,
    //     canSelectMany: false,
    //     openLabel: message || 'Select Folder',
    //     filters: filters || {
    //         'All Files': ['*']
    //     }
    // })

    // if (folderUri && folderUri[0]) {
    //     return folderUri[0].fsPath
    // }
}

export const select = async (message, choices) => {

    return inquirer.select({
        message, choices
    })
}

export const confirm = async (message, choices) => {

    return inquirer.confirm({
        message: message || 'Are you sure?',
    })
}

export const navigate = async (message, url) => {
    const proceed = await inquirer.confirm({
        message: message || 'This will launch url in browser',
    })

    if (proceed) {
        await open(url)
    }
}
