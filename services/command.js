// const templateHelper = require('../helpers/template')

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const constant = require('./constant');

exports.run = async (argv) => {
    argv = argv || process.argv
    let cmd = yargs(hideBin(argv));
    for (const item of constant.actions.search()) {
        const handler = require(`../handlers/${item.handler}`)

        if (!handler) {
            console.error(`Handeler for '${item.code}' not found`);
            continue;
        }

        cmd = cmd.command(
            item.code,
            item.title,
            (yargs) => {
                for (const f of item.config.fields) {
                    yargs = yargs.option(f.key, {
                        alias: f.code,
                        description: f.label,
                        type: f.type,
                    });
                }
                return yargs;
            },
            handler.process
        );
    }

    cmd.help().argv;
}

exports.get = () => {
    const argv = yargs(hideBin(process.argv)).argv;
    if (argv._.length > 0) {
        return argv._[0]
    }
}
