// const templateHelper  from  '../helpers/template')

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as constant from '../../lib/constants/index.js'
import * as input from '../../lib/helpers/input.js'

export const execute = async (item, options) => {
    const handler = await import(`../../lib/handlers/${item.handler}.js`)

    if (!handler) {
        throw new Error('HANDLER_NF', {
            cause: `Handler for '${item.code}' not found`
        })
    }
    let params = {}

    for (const key in options) {
        if (!Object.hasOwn(options, key) || key === '$0'
        ) continue;

        const args = options[key]

        if (key === '_') {
            if (Array.isArray(args)) {
                if (args.length) {
                    args.shift()
                }

                if (handler.parse) {
                    params = handler.parse(args)
                } else {
                    for (const a of args) {
                        const p = input.parse(a)

                        if (typeof p === 'string') {
                            params.local = p
                        } else {
                            switch (p.resource?.type) {
                                case 'file':
                                case 'folder':
                                    params.local = p.resource
                                    break
                                case 'http':
                                case 'https':
                                    params.remote = p.resource
                                    break
                            }
                        }
                    }
                }
            }
        } else {

            params[key] = Array.isArray(options[key]) ? options[key].map(p => input.parse(p)) : input.parse(options[key])
        }
    }
    await handler.execute(params)
}

export const run = async (argv) => {
    argv = argv || process.argv
    let cmd = yargs(hideBin(argv))
    for (const item of constant.actions.search()) {

        cmd = cmd.command(
            item.code,
            item.title,
            (yargs) => {
                for (const f of item.config.fields) {
                    yargs = yargs.option(f.key, {
                        alias: f.code,
                        description: f.label,
                        type: f.type,
                    })
                }
                return yargs
            },
            async (options) => execute(item, options)
        )
    }

    cmd.help().argv
}

export const get = () => {
    const argv = yargs(hideBin(process.argv)).argv
    // @ts-ignore
    if (argv._.length > 0) {
        // @ts-ignore
        return argv._[0]
    }
}
