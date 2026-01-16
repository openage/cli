import moment from 'moment-timezone'

export const day = (date) => {
    const dayOfWeek = date ? moment(date).weekday() : moment().weekday()

    switch (dayOfWeek) {
        case 0:
            return 'sunday'
        case 1:
            return 'monday'
        case 2:
            return 'tuesday'
        case 3:
            return 'wednesday'
        case 4:
            return 'thursday'
        case 5:
            return 'friday'
        case 6:
            return 'saturday'
    }
}

export const diff = (date1, date2) => {
    let value = moment(date1).diff(moment(date2), 'seconds')
    if (value < 0) {
        value = -value
    }
    return value
}
export const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const minutes = (fromMinutes) => {
    return {
        toString: () => {
            if (!fromMinutes) {
                fromMinutes = 0
            }
            const hoursWorked = Math.floor(fromMinutes / 60)
            const minutesWorked = Math.floor(fromMinutes - hoursWorked * 60)

            let hours = '00'
            if (hoursWorked === 0) {
                hours = '00'
            } else if (hoursWorked < 10) {
                hours = `0${hoursWorked}`
            } else {
                hours = `${hoursWorked}`
            }

            let minutes = '00'
            if (minutesWorked === 0) {
                minutes = '00'
            } else if (minutesWorked < 10) {
                minutes = `0${minutesWorked}`
            } else {
                minutes = `${minutesWorked}`
            }

            return `${hours}:${minutes}`
        }
    }
}
export const time = (time1) => {
    time1 = time1 || new Date()
    return {
        diff: (time2, actual) => {
            let value = moment(time1).diff(moment(time2), 'seconds')

            if (actual) {
                return value
            }
            if (value < 0) {
                value = -value
            }

            return value
        },

        add: (minutes) => {
            return moment(time1).add(minutes, 'minute').toDate()
        },
        subtract: (minutes) => {
            return moment(time1).subtract(minutes, 'minute').toDate()
        },
        span: (time2) => {
            const date = moment()

            const timeA = date
                .set('hour', moment(time1).get('hour'))
                .set('minute', moment(time1).get('minute'))
                .set('second', moment(time1).get('second'))
                .set('millisecond', moment(time1).get('millisecond')).toDate()

            const timeB = date
                .set('hour', moment(time2).get('hour'))
                .set('minute', moment(time2).get('minute'))
                .set('second', moment(time2).get('second'))
                .set('millisecond', moment(time2).get('millisecond')).toDate()

            let value = moment(timeA).diff(moment(timeB), 'minutes')

            if (value < 0) {
                value = -value
            }

            let hours = value / 60

            hours = parseInt(hours.toFixed(2))
            let minutes = value - hours * 60

            let text = ''

            if (hours === 0) {
                text = '00'
            } else if (hours < 10) {
                text = `0${hours}`
            }

            if (minutes === 0) {
                return `${text}:${minutes}`
            } else if (minutes < 10) {
                return `${text}:0${minutes}`
            }
        },
        isBetween: (from, till) => {
            return moment(time1).isBetween(moment(from), moment(till), 's', '[]')
        },
        lt: (time2) => {
            if (!time2 || (!time1 && !time2)) {
                return false
            }

            if (!time1) {
                return true
            }

            const date = new Date()

            const timeA = moment(date)
                .set('hour', moment(time1).hour())
                .set('minute', moment(time1).minutes())
                .set('second', moment(time1).seconds())

            const timeB = moment(date)
                .set('hour', moment(time2).hour())
                .set('minute', moment(time2).minutes())
                .set('second', moment(time2).seconds())

            return (timeA.isBefore(timeB, 's'))
        },
        gt: (time2) => {
            if (!time2 || (!time1 && !time2)) {
                return false
            }

            if (!time1) {
                return true
            }

            const date = new Date()

            const timeA = moment(date)
                .set('hour', moment(time1).hour())
                .set('minute', moment(time1).minutes())
                .set('second', moment(time1).seconds())

            const timeB = moment(date)
                .set('hour', moment(time2).hour())
                .set('minute', moment(time2).minutes())
                .set('second', moment(time2).seconds())

            return (timeA.isAfter(timeB, 's'))
        },
        toString: (format) => {
            format = format || 'h:mm:ss a'
            return moment(time1).format(format)
        }
    }
}

export const date = (date1) => {
    date1 = date1 || new Date()

    if (typeof date1 === 'string') {
        switch (date1.toLowerCase()) {
            case 'yesterday':
                date1 = moment().subtract(1, 'day').startOf('day').toDate()
                break
            case 'now':
                date1 = new Date()
                break
            case 'today':
                date1 = new Date()
                break
            case 'tomorrow':
                date1 = moment().add(1, 'day').startOf('day').toDate()
                break
            case 'bod':
                date1 = moment().startOf('day').toDate()
                break
            case 'previous-bom':
                date1 = moment().startOf('month').subtract(1, 'day').startOf('month').toDate()
                break
            case 'previous-boy':
                date1 = moment().startOf('year').subtract(1, 'day').startOf('year').toDate()
                break
            case 'bom':
                date1 = moment().startOf('month').toDate()
                break
            case 'boy':
                date1 = moment().startOf('year').toDate()
                break
            case 'eod':
                date1 = moment().endOf('day').toDate()
                break
            case 'previous-eom':
                date1 = moment().startOf('month').subtract(1, 'day').endOf('month').toDate()
                break
            case 'eom':
                date1 = moment().endOf('month').toDate()
                break
            case 'eoy':
                date1 = moment(date1).endOf('year').toDate()
                break
        }
    }

    return {
        isValid: () => {
            return moment(date1).isValid()
        },

        dates: (count) => {
            const items = []

            if (typeof count === 'number') {
                for (let i = 0; i < count; i++) {
                    items.push(moment(date1).add(i, 'day').startOf('day').toDate())
                }
            }

            return items
        },
        diff: (date2, actual) => {
            let value = moment(date1).diff(moment(date2), 'day')

            if (actual) {
                return value
            }
            if (value < 0) {
                value = -value
            }

            return value
        },
        day: () => {
            return day(date1)
        },
        bod: (options) => {
            options = options || {}
            if (options.add) {
                moment(date1).add(options.add, 'day').startOf('day').toDate()
            } else if (options.subtract) {
                moment(date1).subtract(options.subtract, 'day').startOf('day').toDate()
            } else {
                return moment(date1).startOf('day').toDate()
            }
        },
        bow: () => {
            return moment(date1).startOf('week').toDate()
        },
        bom: () => {
            return moment(date1).startOf('month').toDate()
        },
        boy: () => {
            return moment(date1).startOf('year').toDate()
        },
        previousWeek: () => {
            return moment(date1).subtract(7, 'days').startOf('day').toDate()
        },
        previousBod: () => {
            return moment(date1).subtract(1, 'day').startOf('day').toDate()
        },
        nextBod: () => {
            return moment(date1).add(1, 'day').startOf('day').toDate()
        },
        nextWeek: () => {
            return moment(date1).add(7, 'days').startOf('day').toDate()
        },
        eod: (options) => {
            options = options || {}
            if (options.add) {
                moment(date1).add(options.add, 'day').endOf('day').toDate()
            } else if (options.subtract) {
                moment(date1).subtract(options.subtract, 'day').endOf('day').toDate()
            } else {
                return moment(date1).endOf('day').toDate()
            }
        },
        eow: () => {
            return moment(date1).endOf('week').toDate()
        },
        eom: () => {
            return moment(date1).endOf('month').toDate()
        },
        eoy: () => {
            return moment(date1).endOf('year').toDate()
        },
        add: (days) => {
            return moment(date1).add(days, 'day').toDate()
        },
        subtract: (days) => {
            return moment(date1).subtract(days, 'day').toDate()
        },
        setTime: (time) => {
            return moment(date1)
                .set('hour', moment(time).get('hour'))
                .set('minute', moment(time).get('minute'))
                .set('second', moment(time).get('second'))
                .set('millisecond', moment(time).get('millisecond')).toDate()
        },
        isSame: (date2) => {
            if ((!date1 && date2) || (date1 && !date2)) {
                return false
            }
            return moment(date1).startOf('day').isSame(moment(date2).startOf('day'))
        },
        isToday: () => {
            return moment(date1).startOf('day').isSame(moment(new Date()).startOf('day'))
        },
        isPast: () => {
            return moment(date1).startOf('day').isBefore(moment(new Date()).startOf('day'))
        },
        isFuture: () => {
            return moment(date1).startOf('day').isAfter(moment(new Date()).startOf('day'))
        },
        isBetween: (from, till) => {
            return moment(date1).isBetween(moment(from), moment(till), 'day', '[]')
        },
        toString: (format) => {
            if (!date1) {
                return ''
            }
            format = format || 'DD-MM-YYYY'
            if (format.toLowerCase() === 'iso') {
                return date1.toISOString
            }
            return moment(date1).format(format)
        },
        toCron: () => {
            return moment(date1).format('s m H D MMM YYYY').toUpperCase()
        },
        toDate: () => {
            return date1
        }
    }
}
