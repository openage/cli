const toWords = (num) => {
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

const toLocale = (value, locale) => {
    if (!value) {
        return '0.00'
    }

    locale = locale || 'en-IN'
    value = value.toFixed(2)

    const nf = new Intl.NumberFormat(locale, {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false
    })
    return nf.format(value) // "1,234,567,890"

}

const toString = (value, format) => {
    if (!value) {
        return '0.00'
    }

    switch (format) {

        case 'words':
            return toWords(value)

        case 'currency':
            return Math.ceil(value * 1000) / 1000

        default:
            return toLocale(value, format)
    }

}

export default (value) => {
    return {
        calculate: (operation) => {
            if (!value) {
                return 0
            }
            const values = Array.isArray(value) ? value : [value]

            let result = 0

            switch (operation) {
                case 'sum':
                    result = 0
                    for (const v of values) {
                        result = result + v
                    }
                    return result

                case 'product':
                    result = 1
                    for (const v of values) {
                        result = result * v
                    }
                    return result
            }
        },
        toString: (format) => {
            return toString(value, format)
        }
    }
}
