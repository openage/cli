#!/usr/bin/env node
process.env.NODE_NO_WARNINGS = '1'
process.env.OA_CWD = process.env.OA_CWD || process.cwd()

const getArg = (name) => {
    const prefix = `--${name}=`
    const arg = process.argv.find(a => a.startsWith(prefix))
    return arg ? arg.replace(prefix, '') : null
}
const env = getArg('env')
if (env && !process.env.NODE_ENV) {
    process.env.NODE_ENV = env
}

// Import the ES module
import('file:///D:/code/oa/tools/cli/index.js').catch(err => {
    console.error('Failed to load application:', err)
    console.error('Current working directory:', process.cwd())
    console.error('Script path:', __filename)
    process.exit(1)
})
