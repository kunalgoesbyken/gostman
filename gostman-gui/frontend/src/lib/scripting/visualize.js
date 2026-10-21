import { MAX_VISUAL_CHARS } from './limits'

const OPEN = '{{'
const CLOSE = '}}'
const BLOCK_PREFIX = '#'
const END_PREFIX = '/'
const SELF = 'this'
const INDEX = '@index'
const KEY = '@key'
const PATH_SEPARATOR = '.'
const BLOCKS = ['each', 'if']

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }
const BIDI_CONTROLS = new Set([0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069])

const TABLE_TEMPLATE = [
  '<table><thead><tr>{{#each columns}}<th>{{this}}</th>{{/each}}</tr></thead>',
  '<tbody>{{#each rows}}<tr>{{#each cells}}<td>{{this}}</td>{{/each}}</tr>{{/each}}</tbody></table>',
].join('')

export const escapeHtml = (text) => (
  Array.from(text, (character) => ESCAPES[character] ?? (BIDI_CONTROLS.has(character.codePointAt(0)) ? '' : character)).join('')
)

function tokenize(template) {
  const tokens = []
  let cursor = 0
  while (cursor < template.length) {
    const start = template.indexOf(OPEN, cursor)
    const end = start < 0 ? -1 : template.indexOf(CLOSE, start + OPEN.length)
    if (end < 0) {
      tokens.push({ text: template.slice(cursor) })
      break
    }
    if (start > cursor) tokens.push({ text: template.slice(cursor, start) })
    tokens.push({ tag: template.slice(start + OPEN.length, end).trim() })
    cursor = end + CLOSE.length
  }
  return tokens
}

function parse(tokens) {
  const root = { children: [] }
  const open = [root]
  for (const token of tokens) {
    const current = open[open.length - 1]
    if (token.text !== undefined) {
      current.children.push({ text: token.text })
    } else if (token.tag.startsWith(BLOCK_PREFIX)) {
      const [name, path = SELF] = token.tag.slice(BLOCK_PREFIX.length).trim().split(/\s+/)
      if (!BLOCKS.includes(name)) throw new Error(`Unknown template block "${name}".`)
      const block = { name, path, children: [] }
      current.children.push(block)
      open.push(block)
    } else if (token.tag.startsWith(END_PREFIX)) {
      const name = token.tag.slice(END_PREFIX.length).trim()
      if (open.length === 1 || current.name !== name) throw new Error(`Unexpected {{/${name}}} in the template.`)
      open.pop()
    } else {
      current.children.push({ path: token.tag })
    }
  }
  if (open.length > 1) throw new Error(`The template block "${open[open.length - 1].name}" is never closed.`)
  return root.children
}

const isOwn = (container, name) => container !== null && typeof container === 'object' && Object.hasOwn(container, name)

const frameValue = (frame, name) => {
  if (name === SELF) return frame.value
  if (name === INDEX) return frame.index
  return name === KEY ? frame.key : undefined
}

function lookup(frames, path) {
  const [head, ...rest] = path.split(PATH_SEPARATOR)
  const innermost = frames[frames.length - 1]
  const owner = [...frames].reverse().find((frame) => isOwn(frame.value, head))
  const start = frameValue(innermost, head) ?? (owner ? owner.value[head] : undefined)
  return rest.reduce((value, name) => (isOwn(value, name) ? value[name] : undefined), start)
}

function stringify(value) {
  if (value === undefined || value === null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const isPresent = (value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))

const entriesOf = (value) => (Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value || {}))

function emit(output, text) {
  output.size += text.length
  if (output.size > MAX_VISUAL_CHARS) throw new Error('The visualization is larger than the allowed size.')
  output.parts.push(text)
}

function render(nodes, frames, output) {
  for (const node of nodes) {
    if (node.text !== undefined) {
      emit(output, node.text)
    } else if (node.name === 'if') {
      if (isPresent(lookup(frames, node.path))) render(node.children, frames, output)
    } else if (node.name === 'each') {
      for (const [key, value] of entriesOf(lookup(frames, node.path))) {
        render(node.children, [...frames, { value, index: Number(key), key }], output)
      }
    } else {
      emit(output, escapeHtml(stringify(lookup(frames, node.path))))
    }
  }
}

export function renderTemplate(template, data) {
  const output = { parts: [], size: 0 }
  render(parse(tokenize(String(template))), [{ value: data }], output)
  return output.parts.join('')
}

function tableData(rows) {
  const list = Array.isArray(rows) ? rows : []
  const columns = [...new Set(list.flatMap((row) => (row !== null && typeof row === 'object' ? Object.keys(row) : [])))]
  const cells = (row) => columns.map((column) => (row !== null && typeof row === 'object' ? row[column] : row))
  return { columns, rows: list.map((row) => ({ cells: cells(row) })) }
}

export function createVisualizer(capture) {
  const visualize = (template, data = {}) => capture(renderTemplate(template, data))
  visualize.table = (rows) => capture(renderTemplate(TABLE_TEMPLATE, tableData(rows)))
  return visualize
}
