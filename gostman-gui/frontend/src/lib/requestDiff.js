import YAML from 'js-yaml'
import { diffLines, withContext } from './lineDiff'

const STATUS = { added: 'added', removed: 'removed', changed: 'changed' }

const ORDER = [
  'name', 'method', 'url', 'queryParams', 'headers', 'auth', 'bodyType', 'body', 'graphqlQuery', 'graphqlVariables',
  'grpcMethod', 'grpcMessage', 'grpcProtos', 'mcpMethod', 'mcpTool', 'mcpArguments', 'socketProtocol', 'socketMessages',
  'vars', 'options', 'extractors', 'assertions', 'preScript', 'postScript', 'examples', 'description', 'tags', 'order',
]
const IGNORED = new Set(['timestamp'])
const TEXT_CONTEXT = 2
const LONG_TEXT = 80

const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isBlank = (value) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || (isPlain(value) && Object.keys(value).length === 0)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function show(value) {
  if (typeof value === 'string') return value === '' ? '""' : value
  return JSON.stringify(value)
}

const isRowList = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => isPlain(item) && 'key' in item)

function rowText(row) {
  const flag = row.enabled === false ? ' (off)' : ''
  return `${row.key}: ${show(row.value ?? '')}${flag}`
}

function rowMap(rows) {
  const seen = new Map()
  const map = new Map()
  rows.forEach((row) => {
    const count = (seen.get(row.key) ?? 0) + 1
    seen.set(row.key, count)
    map.set(`${row.key}#${count}`, row)
  })
  return map
}

function rowLines(before, after) {
  const a = rowMap(Array.isArray(before) ? before.filter(isPlain) : [])
  const b = rowMap(Array.isArray(after) ? after.filter(isPlain) : [])
  const out = []
  a.forEach((row, id) => {
    if (!b.has(id)) out.push({ marker: '-', text: rowText(row) })
    else if (!same(row, b.get(id))) out.push({ marker: '-', text: rowText(row) }, { marker: '+', text: rowText(b.get(id)) })
  })
  b.forEach((row, id) => {
    if (!a.has(id)) out.push({ marker: '+', text: rowText(row) })
  })
  return out
}

function entryLines(before, after, prefix = '') {
  const a = isPlain(before) ? before : {}
  const b = isPlain(after) ? after : {}
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  return keys.flatMap((key) => {
    const name = prefix + key
    if (same(a[key], b[key])) return []
    if (isPlain(a[key]) && isPlain(b[key])) return entryLines(a[key], b[key], `${name}.`)
    if (isBlank(a[key])) return [{ marker: '+', text: `${name}: ${show(b[key])}` }]
    if (isBlank(b[key])) return [{ marker: '-', text: `${name}: ${show(a[key])}` }]
    return [{ marker: '-', text: `${name}: ${show(a[key])}` }, { marker: '+', text: `${name}: ${show(b[key])}` }]
  })
}

function itemLines(before, after) {
  const a = Array.isArray(before) ? before : []
  const b = Array.isArray(after) ? after : []
  const keysA = a.map((item) => JSON.stringify(item))
  const keysB = b.map((item) => JSON.stringify(item))
  const describe = (item) => (isPlain(item) ? Object.values(item).map(show).join(' ') : show(item))
  return [
    ...a.filter((_, index) => !keysB.includes(keysA[index])).map((item) => ({ marker: '-', text: describe(item) })),
    ...b.filter((_, index) => !keysA.includes(keysB[index])).map((item) => ({ marker: '+', text: describe(item) })),
  ]
}

const isText = (a, b) => [a, b].some((value) => typeof value === 'string' && (value.includes('\n') || value.length > LONG_TEXT))

function linesOf(before, after) {
  if (isRowList(before) || isRowList(after)) return rowLines(before, after)
  if (isPlain(before) || isPlain(after)) return entryLines(before, after)
  if (Array.isArray(before) || Array.isArray(after)) return itemLines(before, after)
  if (isText(before, after)) {
    const diff = diffLines(typeof before === 'string' ? before : '', typeof after === 'string' ? after : '')
    return withContext(diff, TEXT_CONTEXT).map((line) => (line.marker === '@' ? { marker: '@', text: '...' } : line))
  }
  const out = []
  if (!isBlank(before)) out.push({ marker: '-', text: show(before) })
  if (!isBlank(after)) out.push({ marker: '+', text: show(after) })
  return out
}

function statusOf(before, after) {
  if (isBlank(before)) return STATUS.added
  if (isBlank(after)) return STATUS.removed
  return STATUS.changed
}

function parse(text) {
  if (!text) return {}
  try {
    const value = YAML.load(text)
    return isPlain(value) ? value : null
  } catch {
    return null
  }
}

const rank = (key) => {
  const index = ORDER.indexOf(key)
  return index < 0 ? ORDER.length : index
}

export function fieldChanges(beforeText, afterText) {
  const before = parse(beforeText)
  const after = parse(afterText)
  if (before === null || after === null) return null
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !IGNORED.has(key))
  const ordered = keys.map((key, index) => ({ key, index })).sort((x, y) => rank(x.key) - rank(y.key) || x.index - y.index)
  return ordered
    .filter(({ key }) => !same(before[key], after[key]) && !(isBlank(before[key]) && isBlank(after[key])))
    .map(({ key }) => ({ key, status: statusOf(before[key], after[key]), lines: linesOf(before[key], after[key]) }))
}
