import { foldCase } from './tags.js'

function foldedWithOrigins(text) {
  let folded = ''
  const origins = []
  let offset = 0
  for (const char of text) {
    const part = foldCase(char)
    for (let index = 0; index < part.length; index += 1) origins.push(offset)
    folded += part
    offset += char.length
  }
  origins.push(offset)
  return { folded, origins }
}

export function matchRanges(text, query) {
  const needle = foldCase(query.trim())
  if (!needle) return []
  const { folded, origins } = foldedWithOrigins(text)
  const ranges = []
  for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + needle.length)) {
    ranges.push({ start: origins[at], end: origins[at + needle.length] })
  }
  return ranges
}
