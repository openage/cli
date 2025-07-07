'use strict'
const handlebars = require('handlebars')
const formats = require('config').get('formats')

const dates = require('./dates')

const toWords = function (num) {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen ']
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

    num = parseInt(num)
    if ((num = num.toString()).length > 9) return 'overflow'
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
    if (!n) return
    let str = ''
    str += (+n[1] !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : ''
    str += (+n[2] !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : ''
    str += (+n[3] !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : ''
    str += (+n[4] !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : ''
    str += (+n[5] !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : ''
    return str
}

handlebars.registerHelper('date', function (date, format) {
    if (!date) {
        return ''
    }
    return dates.date(date).toString(format || formats.date || 'DD-MM-YYYY')
})

// {{ convert amount currency 'INR' 'totalA'}}

handlebars.registerHelper('convert', function (amount, from, to, accumulator, options) {
    from = from || 'INR'
    to = to || 'INR'

    const ratios = options.data.root.data.total.currency.ratio || {}

    let multiplier = 1

    if (from !== 'INR') {
        multiplier = ratios[from] || 1
    }

    if (to !== 'INR') {
        multiplier = multiplier / (ratios[to] || 1)
    }

    const value = amount * multiplier

    if (accumulator) {
        options.data.root.totals = options.data.root.totals || {}
        options.data.root.totals[accumulator] = (options.data.root.totals[accumulator] || 0) + value
        options.data.root.totals.sum = Math.ceil(((options.data.root.totals.sum || 0) + value) * 100) / 100
    }

    return value
})

handlebars.registerHelper('currencyformatter', function (value) {
    if (value) {
        value = Math.ceil(value * 1000) / 1000
    }
    return value
})

handlebars.registerHelper('sum', function (arg1, arg2, options) {
    return (arg1 + arg2)
})

handlebars.registerHelper('multiply', function (arg1, arg2, options) {
    return (arg1 * arg2)
})

handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this)
})
handlebars.registerHelper('time', function (date, format) {
    if (!date) {
        return ''
    }
    return dates.date(date).toString(format || formats.time || 'hh:mm:ss A')
})

handlebars.registerHelper('capitalize', function (str) {
    if (!str) {
        return ''
    }
    return str.toUpperCase()
    // replace(/^\w/, c => c.toUpperCase())
})

handlebars.registerHelper('substr', function (str, from, length) {
    if (!str) {
        return ''
    }

    from = from || 0

    if (!length) {
        length = str.length - from
    }
    return str.substr(from, length)
})

// replace all the instances of any symbol or character from the string
handlebars.registerHelper('replaceAll', function (string, search, replace) {
    return string.split(search).join(replace)
})

// 01-11-2021 to 2021-11-01T18:30:00.000Z
handlebars.registerHelper('ISOdate', function (date, format) {
    if (!date) {
        return ''
    }
    date = dates.date(date).toDate(format)
    const ISODate = new Date(date)
    return ISODate.toISOString()
})

// split the string with a symbol and access any part using index(+ve/-ve)
handlebars.registerHelper('splitstr', function (str, symbol, index) {
    if (!str) {
        return ''
    }

    const parts = str.split(symbol)

    index = index || 0

    if (index < 0) {
        index = parts.length + index
    }

    return parts[index]
})

// ((csv abcd,xyz,123 2))
handlebars.registerHelper('csv', function (str, position) {
    if (!str) {
        return ''
    }
    const parts = str.split(',')
    const len = parts.length
    let line1 = ''
    const address = []
    for (const i in parts) {
        if (i < len - 3) {
            line1 = line1 + ',' + parts[i]
        }
    }

    address[0] = line1.substr(1)
    for (let i = len - 3, j = 1; i < len; i++) {
        address[j++] = parts[i]
    }

    if (position < 0) {
        return (address[address.length + position]).trim()
    } else {
        return str(address[position]).trim()
    }
}
    // position = position < 0 ? parts.length + position : position
    // return parts[position].trim()
    // replace(/^\w/, c => c.toUpperCase())
)

handlebars.registerHelper('registrationDate', function (str) {
    if (!str) {
        return ''
    }
    return str
    // replace(/^\w/, c => c.toUpperCase())
})

handlebars.registerHelper('inWords', function (num) {
    return toWords(num)
})

// {{number (convert amount currency 'INR' ratios 'totalA') 'commas'}} INR
// {{number 123 'commas'}}
// {{number 123 'words'}}
handlebars.registerHelper('number', function (value, format) {
    if (!value) {
        return '0.00'
    }

    format = format || 'commas'

    if (typeof value !== 'number') {
        return value
    }

    switch (format) {
        case 'commas':
            value = value.toFixed(2)

            const nf = new Intl.NumberFormat('en-IN', {
                minimumIntegerDigits: 1,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,

                useGrouping: false
            })
            return nf.format(value) // "1,234,567,890"

        case 'words':
            return toWords(value)
    }
})

// {{calculate 'sum' [1, 2, 3]}}
handlebars.registerHelper('calculate', function (operation, values) {
    if (!values) {
        return 0
    }

    let result = 0

    switch (operation) {
        case 'sum':
            result = 0
            for (const value of values) {
                result = result + value
            }
            return result

        case 'product':
            result = 1
            for (const value of values) {
                result = result * value
            }
            return result
    }
})
handlebars.registerHelper('eq', function (a, b, opts) {
    if (a === b) { // Or === depending on your needs
        return opts.fn(this)
    } else {
        return opts.inverse(this)
    }
})

handlebars.registerHelper('neq', function (a, b, opts) {
    if (a !== b) {
        return opts.fn(this)
    } else {
        return opts.inverse(this)
    }
})

handlebars.registerHelper('minhrsConversion', function (mins) {
    if (!mins) {
        return ''
    }

    let text
    if (mins >= 60) {
        if (mins === 60) {
            text = '1 hours'
        }

        const rem = mins % 60
        const hrs = (mins - rem) / 60
        text = `${hrs} hours ${rem} minutes`
    } else {
        text = `${mins} minutes`
    }

    return text
})

handlebars.registerHelper('ge', function (a, b) {
    const next = arguments[arguments.length - 1]
    return (a >= b) ? next.fn(this) : next.inverse(this)
})

// greater than
handlebars.registerHelper('gt', function (a, b) {
    const next = arguments[arguments.length - 1]
    return (a > b) ? next.fn(this) : next.inverse(this)
})

handlebars.registerHelper('lt', function (a, b) {
    const next = arguments[arguments.length - 1]
    return (a < b) ? next.fn(this) : next.inverse(this)
})

// not equal
handlebars.registerHelper('ne', function (a, b) {
    const next = arguments[arguments.length - 1]
    return (a !== b) ? next.fn(this) : next.inverse(this)
})

exports.formatter = function (format) {
    const isObject = typeof format === 'object'

    if (isObject) {
        format = JSON.stringify(format)
    }
    const template = handlebars.compile(format)
    return {
        inject: function (data) {
            let value = template(data)

            if (isObject) {
                value = JSON.parse(value.replace(/\\/g, '\\\\'))
            }

            return value
        }
    }
}
