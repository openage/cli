const data = (items) => {

    const obj = {}
    items.forEach((item) => {
        obj[item.code.toLowerCase()] = item.ref ? obj[item.ref] : item
    })

    return {

        get: (code) => {
            if (!code) return
            return obj[code.toLowerCase()]
        },
        search: () => {
            return items
        }
    }
}

import actionsArr from './actions.js'
import inputsArr from './inputs.js'
import errorsArr from './errors.js'
import transformsArr from './transforms.js'

export const actions = data(actionsArr)
export const inputs = data(inputsArr)
export const errors = data(errorsArr)
export const transforms = data(transformsArr)
