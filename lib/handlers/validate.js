import fs from 'fs'
import pathModule from 'path'
import * as file from '../helpers/file.js'
import * as input from '../helpers/input.js'
import * as context from '../services/context.js'
import logger from '../helpers/logger.js'
import * as notifications from '../helpers/notifications.js'
import text from '../helpers/text.js'

/**
 * Validates a JSON file against a schema defined in the project's schema index.
 * Automatically discovers the schema based on file folder or prompts the user.
 * 
 * @param {object} params - Command parameters containing the 'file' path.
 */
export const execute = async (params) => {
    const log = logger('handlers.validate')
    
    // 1. Resolve Target File Path
    const workspaceRoot = process.env.OA_CWD || process.cwd()
    let filePath = params.file || params.local
    
    // Support parsed resource objects (common for positional arguments)
    if (filePath && typeof filePath === 'object') {
        filePath = filePath.path || filePath.file || filePath.folder
    }

    if (!filePath) {
        console.error('\x1b[31mNo file path provided for validation.\x1b[0m')
        return
    }

    const targetFilePath = pathModule.resolve(workspaceRoot, filePath)
    
    if (!fs.existsSync(targetFilePath)) {
        console.error(`\x1b[31mFile not found: ${params.file}\x1b[0m`)
        return
    }
    
    const targetFolder = pathModule.dirname(targetFilePath)
    const relativeTargetFolder = pathModule.relative(workspaceRoot, targetFolder)

    // 2. Load Schema Index
    const schemaIndexPath = file.path({ folder: '$oa/schemas', file: 'index.json' })
    if (!fs.existsSync(schemaIndexPath)) {
        console.error('Schema index (.oa/schemas/index.json) not found.')
        return
    }
    
    let schemaIndex = JSON.parse(fs.readFileSync(schemaIndexPath, 'utf8'))
    const paths = context.paths()

    // 3. Find matching folder entry
    let folderMatch = (schemaIndex.folders || []).find(entry => {
        let entryPath = entry.path
        // Resolve shortcuts ($content, $oa, etc.)
        for (const [key, value] of Object.entries(paths)) {
            if (entryPath.startsWith(key)) {
                entryPath = pathModule.join(value, entryPath.replace(key, ''))
                break
            }
        }
        
        // Normalize paths for comparison
        const absEntryPath = pathModule.isAbsolute(entryPath) ? entryPath : pathModule.resolve(workspaceRoot, entryPath)
        return absEntryPath.toLowerCase() === targetFolder.toLowerCase()
    })

    let schemaCode
    let rootKey
    
    if (!folderMatch) {
         console.log(`No folder mapping found for: ${relativeTargetFolder}`)
         
         const choices = (schemaIndex.items || []).map(i => ({ 
             name: i.title || i.code, 
             value: i.code 
         }))
         
         if (choices.length === 0) {
             console.error('No schemas available in schema index.')
             return
         }

         // Use the established input helper for selection
         const selectedCode = await input.get({ 
             type: 'list',
             name: 'schema',
             message: 'Which schema should be used for this folder?', 
             choices 
         })
         
         if (!selectedCode) return

         schemaCode = selectedCode
         
         // Determine shortcut path
         let shortcutPath = relativeTargetFolder || '.'
         if (targetFolder.startsWith(paths.$content)) {
             shortcutPath = pathModule.join('$content', pathModule.relative(paths.$content, targetFolder))
         } else if (targetFolder.startsWith(paths.$oa)) {
             shortcutPath = pathModule.join('$oa', pathModule.relative(paths.$oa, targetFolder))
         }

         // Update and save index
         schemaIndex.folders = schemaIndex.folders || []
         schemaIndex.folders.push({
             path: shortcutPath.replace(/\\/g, '/'),
             schema: schemaCode,
             enforce: true
         })
         
         fs.writeFileSync(schemaIndexPath, JSON.stringify(schemaIndex, null, 2), 'utf8')
         console.log(`\x1b[32m✔ Mapping saved to schema index.\x1b[0m`)
    } else {
        schemaCode = folderMatch.schema
        rootKey = folderMatch.root
    }

    // 4. Load Schema Definition
    const item = schemaIndex.items.find(i => i.code === schemaCode)
    if (!item) {
        console.error(`Schema code "${schemaCode}" not found in schema index items.`)
        return
    }

    const schemaFilePath = file.path({ folder: '$oa/schemas', file: item.path })
    if (!fs.existsSync(schemaFilePath)) {
        console.error(`Schema file not found: ${item.path}`)
        return
    }
    const schema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf8'))

    // 5. Load and Prepare Target Data
    let content = JSON.parse(fs.readFileSync(targetFilePath, 'utf8'))
    if (rootKey) {
        content = content[rootKey]
        if (!content) {
            console.error(`Root key "${rootKey}" not found in data file.`)
            return
        }
    }

    // 6. Perform Validation
    notifications.message(`\n Validating: ${params.file} `, 'info-highlighted')
    notifications.message(` Schema: ${text(schemaCode).toString('title')} `, 'info')
    
    // In Ajv 8, we use the 2020 spec for Draft 2020-12 schemas
    const Ajv2020 = (await import('ajv/dist/2020.js')).default
    const ajv2020 = new Ajv2020({ allErrors: true, strict: false })

    // Add all schemas to the instance to support $ref resolution
    for (const sItem of schemaIndex.items) {
        const sPath = file.path({ folder: '$oa/schemas', file: sItem.path })
        if (fs.existsSync(sPath)) {
            const sContent = JSON.parse(fs.readFileSync(sPath, 'utf8'))
            ajv2020.addSchema(sContent, sItem.path)
        }
    }

    const validate = ajv2020.compile(schema)
    const isValid = validate(content)

    if (isValid) {
        notifications.message('✔  Passed: 1', 'success')
        notifications.message('✖  Failed: 0', 'error')
        
        notifications.data('Result', {
            headers: ['Result', 'Property', 'Message'],
            rows: [[' ✔ PASS ', '(root)', 'File matches schema']]
        }, {
            view: 'tabular',
            conditions: {
                '0': [{ value: ' ✔ PASS ', style: 'success' }]
            }
        })
    } else {
        const errors = validate.errors
        notifications.message(`✔  Passed: 0`, 'success')
        notifications.message(`✖  Failed: ${errors.length}`, 'error')

        notifications.data('Result', {
            headers: ['Result', 'Property', 'Message', 'Details'],
            rows: errors.map(err => {
                const path = err.instancePath || '(root)'
                const paramsStr = err.params ? Object.entries(err.params).map(([k, v]) => `${k}:${v}`).join(', ') : ''
                return [' ✖ FAIL ', path, err.message, paramsStr]
            })
        }, {
            view: 'tabular',
            conditions: {
                '0': [{
                    value: ' ✔ PASS ',
                    style: 'success'
                }, {
                    value: ' ✖ FAIL ',
                    style: 'error'
                }]
            }
        })
    }
}
