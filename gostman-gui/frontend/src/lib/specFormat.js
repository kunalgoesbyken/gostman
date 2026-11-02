import { parseDocument, stringify } from 'yaml'

const INDENT = '  '

function members(items, open, close, level) {
  if (items.length === 0) return `${open}${close}`
  const inner = INDENT.repeat(level + 1)
  return `${open}\n${items.map((item) => inner + item).join(',\n')}\n${INDENT.repeat(level)}${close}`
}

function jsonOf(value, level) {
  if (value instanceof Map) {
    return members([...value].map(([key, item]) => `${JSON.stringify(String(key))}: ${jsonOf(item, level + 1)}`), '{', '}', level)
  }
  if (Array.isArray(value)) return members(value.map((item) => jsonOf(item, level + 1)), '[', ']', level)
  return JSON.stringify(value) ?? 'null'
}

export function convertSpec(text, format) {
  const parsed = parseDocument(text)
  if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message)
  const value = parsed.toJS({ mapAsMap: true })
  return format === 'json' ? `${jsonOf(value, 0)}\n` : stringify(value, { lineWidth: 0 })
}
