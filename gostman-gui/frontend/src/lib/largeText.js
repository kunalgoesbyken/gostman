export const LARGE_BODY_CHARS = 500_000

const NEWLINE = '\n'

export function breakRows(text, columns) {
  const starts = []
  const ends = []
  let lineStart = 0
  while (lineStart <= text.length) {
    const newline = text.indexOf(NEWLINE, lineStart)
    const lineEnd = newline < 0 ? text.length : newline
    let start = lineStart
    do {
      starts.push(start)
      ends.push(Math.min(start + columns, lineEnd))
      start += columns
    } while (start < lineEnd)
    lineStart = lineEnd + 1
  }
  return { starts, ends }
}

export function firstAtOrAfter(sorted, value) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (sorted[middle] < value) low = middle + 1
    else high = middle
  }
  return low
}

export function lastAtOrBefore(sorted, value) {
  return firstAtOrAfter(sorted, value + 1) - 1
}
