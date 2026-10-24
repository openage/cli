const normalizeLine = (value, ignoreWhitespace) => ignoreWhitespace ? value.trim().replace(/\s+/g, ' ') : value

export const calculateDiffRows = (leftText, rightText, lookahead = 32, ignoreWhitespace = true) => {
    const left = String(leftText ?? '').split('\n')
    const right = String(rightText ?? '').split('\n')
    const rows = []
    let i = 0
    let j = 0
    const addChanged = (a, b) => {
        rows.push({ leftLine: a, rightLine: b, changed: true })
    }
    while (i < left.length || j < right.length) {
        if (i < left.length && j < right.length && normalizeLine(left[i], ignoreWhitespace) === normalizeLine(right[j], ignoreWhitespace)) {
            rows.push({ leftLine: i++, rightLine: j++, changed: false })
            continue
        }
        let leftMatch = -1
        let rightMatch = -1
        for (let step = 1; step <= lookahead && leftMatch < 0 && i + step < left.length; step++) {
            for (let offset = 0; offset <= lookahead && j + offset < right.length; offset++) {
                if (normalizeLine(left[i + step], ignoreWhitespace) === normalizeLine(right[j + offset], ignoreWhitespace)) {
                    leftMatch = i + step
                    break
                }
            }
        }
        for (let step = 1; step <= lookahead && rightMatch < 0 && j + step < right.length; step++) {
            for (let offset = 0; offset <= lookahead && i + offset < left.length; offset++) {
                if (normalizeLine(right[j + step], ignoreWhitespace) === normalizeLine(left[i + offset], ignoreWhitespace)) {
                    rightMatch = j + step
                    break
                }
            }
        }
        if (leftMatch < 0 && rightMatch < 0) {
            if (i < left.length || j < right.length) addChanged(i < left.length ? i++ : null, j < right.length ? j++ : null)
        } else {
            const leftDistance = leftMatch < 0 ? Infinity : leftMatch - i
            const rightDistance = rightMatch < 0 ? Infinity : rightMatch - j
            if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance)) {
                const paired = Math.min(leftDistance, rightDistance)
                for (let count = 0; count < paired; count++) addChanged(i++, j++)
                while (i < leftMatch) addChanged(i++, null)
                while (j < rightMatch) addChanged(null, j++)
            } else if (leftDistance <= rightDistance) {
                while (i < leftMatch) addChanged(i++, null)
            } else {
                while (j < rightMatch) addChanged(null, j++)
            }
        }
    }
    return rows
}

export const getChangedHunks = (rows) => {
    const hunks = []
    rows.forEach((row, index) => {
        if (!row.changed) return
        const prior = hunks.at(-1)
        if (prior && prior.end === index - 1) prior.end = index
        else hunks.push({ start: index, end: index })
    })
    return hunks
}

const findInlineRange = (left = '', right = '') => {
    let start = 0
    while (start < left.length && start < right.length && left[start] === right[start]) start++
    let leftEnd = left.length
    let rightEnd = right.length
    while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) {
        leftEnd--
        rightEnd--
    }
    return { start, leftEnd, rightEnd }
}

const normalizeWithOffsets = (source) => {
    const text = normalizeLine(source, true)
    const starts = []
    const ends = []
    let sourceIndex = 0
    let normalizedIndex = 0
    while (sourceIndex < source.length && normalizedIndex < text.length) {
        if (/\s/.test(source[sourceIndex])) {
            const whitespaceStart = sourceIndex
            while (sourceIndex < source.length && /\s/.test(source[sourceIndex])) sourceIndex++
            if (text[normalizedIndex] === ' ') {
                starts.push(whitespaceStart)
                ends.push(sourceIndex)
                normalizedIndex++
            }
        } else {
            starts.push(sourceIndex)
            ends.push(sourceIndex + 1)
            sourceIndex++
            normalizedIndex++
        }
    }
    return { text, starts, ends, sourceLength: source.length }
}

export const inlineRange = (left = '', right = '', ignoreWhitespace = true) => {
    if (!ignoreWhitespace) return findInlineRange(left, right)
    const normalizedLeft = normalizeWithOffsets(left)
    const normalizedRight = normalizeWithOffsets(right)
    const range = findInlineRange(normalizedLeft.text, normalizedRight.text)
    const sourceStart = (mapping, index) => index >= mapping.starts.length ? mapping.sourceLength : mapping.starts[index]
    const sourceEnd = (mapping, index) => index <= 0 ? 0 : (mapping.ends[index - 1] ?? mapping.sourceLength)
    return {
        start: sourceStart(normalizedLeft, range.start),
        leftEnd: sourceEnd(normalizedLeft, range.leftEnd),
        rightEnd: sourceEnd(normalizedRight, range.rightEnd)
    }
}
