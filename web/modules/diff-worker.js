import { calculateDiffRows } from './diff-engine.js'

self.onmessage = (event) => {
    const { id, left, right, ignoreWhitespace } = event.data || {}
    self.postMessage({ id, rows: calculateDiffRows(left, right, 32, Boolean(ignoreWhitespace)) })
}
