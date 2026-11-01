import { asText } from './variableScopes'

const LINE_BREAK = /\r?\n/
const ASSIGN = '='

const isMultiline = (text) => /[\r\n]/.test(text)

export const isLinePlain = (row) => (
  row.enabled !== false
  && !row.secret
  && !row.ref
  && row.name !== ''
  && !row.name.includes(ASSIGN)
  && !isMultiline(row.name)
  && !isMultiline(asText(row.value))
  && row.name === row.name.trim()
)

export const linesOf = (rows) => rows
  .filter(isLinePlain)
  .map((row) => `${row.name}${ASSIGN}${asText(row.value)}`)
  .join('\n')

export const heldRows = (rows) => rows.filter((row) => !isLinePlain(row))

function parseLine(line) {
  const at = line.indexOf(ASSIGN)
  const name = (at === -1 ? line : line.slice(0, at)).trim()
  return { name, value: at === -1 ? '' : line.slice(at + 1) }
}

export function rowsFromLines(text, rows) {
  const previous = new Map(rows.filter(isLinePlain).map((row) => [row.name, row]))
  const parsed = new Map()
  for (const line of text.split(LINE_BREAK)) {
    const { name, value } = parseLine(line)
    if (name === '') continue
    const before = previous.get(name)
    parsed.set(name, before && asText(before.value) === value ? before : { name, value, secret: false, enabled: true })
  }
  const held = heldRows(rows).filter((row) => !parsed.has(row.name))
  return [...held, ...parsed.values()]
}
