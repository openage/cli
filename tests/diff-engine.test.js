import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDiffRows, getChangedHunks, inlineRange } from '../web/modules/diff-engine.js'

test('diff engine aligns unchanged context and marks replacements', () => {
    const rows = calculateDiffRows('one\nold\nthree', 'one\nnew\nthree')
    assert.deepEqual(rows.map(({ leftLine, rightLine, changed }) => [leftLine, rightLine, changed]), [
        [0, 0, false], [1, 1, true], [2, 2, false]
    ])
    assert.deepEqual(getChangedHunks(rows), [{ start: 1, end: 1 }])
})

test('diff engine aligns insertions and deletions around stable context', () => {
    const rows = calculateDiffRows('first\nkeep\nlast', 'first\nadded\nkeep')
    assert.deepEqual(rows.map(({ leftLine, rightLine, changed }) => [leftLine, rightLine, changed]), [
        [0, 0, false], [null, 1, true], [1, 2, false], [2, null, true]
    ])
})

test('inline range isolates changed characters while retaining common text', () => {
    assert.deepEqual(inlineRange('prefix old suffix', 'prefix new suffix'), { start: 7, leftEnd: 10, rightEnd: 10 })
    assert.deepEqual(inlineRange('same', 'same'), { start: 4, leftEnd: 4, rightEnd: 4 })
})

test('diff engine handles a 10,000-line file with a localized edit', () => {
    const left = Array.from({ length: 10000 }, (_, index) => `line ${index}`).join('\n')
    const right = left.replace('line 5000', 'changed 5000')
    const rows = calculateDiffRows(left, right)
    assert.equal(rows.length, 10000)
    assert.equal(rows.filter((row) => row.changed).length, 1)
})

test('whitespace differences are ignored by default and can be compared explicitly', () => {
    const left = '  name:   value  '
    const right = 'name: value'
    assert.equal(calculateDiffRows(left, right).some((row) => row.changed), false)
    assert.equal(calculateDiffRows(left, right, 32, false).some((row) => row.changed), true)
})

test('inline ranges exclude whitespace-only variation when whitespace is ignored', () => {
    assert.deepEqual(inlineRange('name:  old', 'name: new'), { start: 7, leftEnd: 10, rightEnd: 9 })
})
