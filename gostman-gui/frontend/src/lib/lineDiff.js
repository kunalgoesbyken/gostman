const CELL_LIMIT = 4_000_000

const splitLines = (text) => {
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

function commonEdges(a, b) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1
  let end = 0
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end += 1
  return { start, end }
}

function lcsTable(a, b) {
  const width = b.length + 1
  const table = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }
  return table
}

function walk(a, b) {
  if (a.length * b.length > CELL_LIMIT) return [...a.map((text) => ({ marker: '-', text })), ...b.map((text) => ({ marker: '+', text }))]
  const width = b.length + 1
  const table = lcsTable(a, b)
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ marker: ' ', text: a[i] })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      out.push({ marker: '-', text: a[i] })
      i += 1
    } else {
      out.push({ marker: '+', text: b[j] })
      j += 1
    }
  }
  for (; i < a.length; i += 1) out.push({ marker: '-', text: a[i] })
  for (; j < b.length; j += 1) out.push({ marker: '+', text: b[j] })
  return out
}

export function diffLines(before, after) {
  const a = splitLines(before)
  const b = splitLines(after)
  const { start, end } = commonEdges(a, b)
  const head = a.slice(0, start).map((text) => ({ marker: ' ', text }))
  const tail = a.slice(a.length - end).map((text) => ({ marker: ' ', text }))
  return [...head, ...walk(a.slice(start, a.length - end), b.slice(start, b.length - end)), ...(end > 0 ? tail : [])]
}

export function withContext(lines, context) {
  const keep = new Array(lines.length).fill(false)
  lines.forEach((line, index) => {
    if (line.marker === ' ') return
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k += 1) keep[k] = true
  })
  const out = []
  let skipping = false
  lines.forEach((line, index) => {
    if (keep[index]) {
      skipping = false
      out.push(line)
    } else if (!skipping) {
      skipping = true
      out.push({ marker: '@', text: '...' })
    }
  })
  return out
}

export function unifiedLines(before, after, context = 4) {
  const lines = diffLines(before, after)
  if (lines.every((line) => line.marker === ' ')) return []
  return withContext(lines, context).map((line) => (line.marker === '@' ? { marker: '@', text: '@@ ... @@' } : { marker: line.marker, text: line.marker + line.text }))
}
