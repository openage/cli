/**
 * Formats a string to Title Case for display in the OA Test Runner logs.
 * @param {string} str 
 */
const uppercaseWords = ['OA', 'API', 'URL', 'ID']

export default (str) => {

    return {
        toString: (format) => {
            switch (format) {
                case 'title':
                    return str.split(/[/\-\s]/).map(word => {
                        if (uppercaseWords.includes(word.toUpperCase())) {
                            return word.toUpperCase()
                        }
                        return word.charAt(0).toUpperCase() + word.slice(1)
                    }).join(' ')

                case 'upper':
                    return str.toUpperCase()
                case 'lower':
                    return str.toLowerCase()
            }

        },
        replace: (search, replace) => {
            return str.split(search).join(replace)
        },
        segment: (symbol, index) => {
            if (!str) {
                return ''
            }

            const parts = str.split(symbol)

            index = index || 0

            if (index < 0) {
                index = parts.length + index
            }

            return parts[index]
        },
        sub: (from, length) => {
            if (!str) {
                return ''
            }

            from = from || 0

            if (!length) {
                length = str.length - from
            }
            return str.substr(from, length)
        },

        variable: () => {
            if (typeof str !== 'string') {
                return
            }

            // ${directory}
            for (const m of str.matchAll(/\$\{([a-zA-Z_][a-zA-Z0-9_-]*)\}/g)) {
                return m[1]
            }

            // {{directory}}
            for (const m of str.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g)) {
                return m[1]
            }

            // $directory (avoid $100, $-1, etc.)
            for (const m of str.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_-]*)\b/g)) {
                return m[1]
            }

            return str
        }
    }
}
