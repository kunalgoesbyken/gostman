import { parseInline } from './inline'
import { CODE_BLOCK, HEADING, LIST, PARAGRAPH, QUOTE, RULE, TABLE } from './nodes'

const MAX_BLOCK_DEPTH = 8
const MAX_INDENT = 3
const MAX_HEADING = 6
const MAX_NUMBER_DIGITS = 9
const FENCE_MARKS = ['`', '~']
const MIN_FENCE = 3
const MIN_RULE = 3
const RULE_MARKS = '-*_'
const BULLETS = '-*+'
const ORDERED_ENDS = '.)'
const DIGITS = '0123456789'
const QUOTE_MARK = '>'
const HEADING_MARK = '#'
const CELL_SEPARATOR = '|'
const ALIGN_MARK = ':'
const DASH = '-'
const NEWLINE = '\n'
const SPACE = ' '
const TAB = '\t'

const isBlank = (line) => line.trim() === ''

const indentOf = (line) => line.length - line.trimStart().length

const isBlankAt = (lines, index) => index < lines.length && isBlank(lines[index])

function skipBlank(lines, index) {
  let cursor = index
  while (isBlankAt(lines, cursor)) cursor += 1
  return cursor
}

function runOf(text, mark) {
  let size = 0
  while (text[size] === mark) size += 1
  return size
}

function fenceOf(line) {
  if (indentOf(line) > MAX_INDENT) return null
  const body = line.trimStart()
  if (!FENCE_MARKS.includes(body[0])) return null
  const size = runOf(body, body[0])
  if (size < MIN_FENCE) return null
  const info = body.slice(size)
  return body[0] === FENCE_MARKS[0] && info.includes(FENCE_MARKS[0]) ? null : { mark: body[0], size }
}

function closesFence(line, fence) {
  const body = line.trim()
  return body.length >= fence.size && body.replaceAll(fence.mark, '') === ''
}

function readFence(lines, index) {
  const fence = fenceOf(lines[index])
  if (!fence) return null
  let end = index + 1
  while (end < lines.length && !closesFence(lines[end], fence)) end += 1
  return { block: { type: CODE_BLOCK, text: lines.slice(index + 1, end).join(NEWLINE) }, next: end + 1 }
}

function runTrailing(text, mark) {
  let size = 0
  while (text[text.length - 1 - size] === mark) size += 1
  return size
}

function withoutClosingMarks(text) {
  const marks = runTrailing(text, HEADING_MARK)
  const head = text.slice(0, text.length - marks)
  const isClosing = marks > 0 && (head === '' || head.endsWith(SPACE) || head.endsWith(TAB))
  return isClosing ? head.trimEnd() : text
}

function headingOf(line) {
  if (indentOf(line) > MAX_INDENT) return null
  const body = line.trimStart()
  const level = runOf(body, HEADING_MARK)
  if (level < 1 || level > MAX_HEADING) return null
  const rest = body.slice(level)
  if (rest !== '' && !rest.startsWith(SPACE) && !rest.startsWith(TAB)) return null
  return { level, text: withoutClosingMarks(rest.trim()) }
}

function readHeading(lines, index) {
  const heading = headingOf(lines[index])
  if (!heading) return null
  return { block: { type: HEADING, level: heading.level, children: parseInline(heading.text) }, next: index + 1 }
}

function isRule(line) {
  if (indentOf(line) > MAX_INDENT) return false
  const marks = line.replaceAll(SPACE, '').replaceAll(TAB, '')
  return marks.length >= MIN_RULE && RULE_MARKS.includes(marks[0]) && marks.replaceAll(marks[0], '') === ''
}

function readRule(lines, index) {
  return isRule(lines[index]) ? { block: { type: RULE }, next: index + 1 } : null
}

const isQuote = (line) => indentOf(line) <= MAX_INDENT && line.trimStart().startsWith(QUOTE_MARK)

function unquote(line) {
  const rest = line.trimStart().slice(QUOTE_MARK.length)
  return rest.startsWith(SPACE) ? rest.slice(1) : rest
}

function readQuote(lines, index, depth) {
  if (!isQuote(lines[index]) || depth >= MAX_BLOCK_DEPTH) return null
  let end = index
  while (end < lines.length && isQuote(lines[end])) end += 1
  const inner = lines.slice(index, end).map(unquote)
  return { block: { type: QUOTE, blocks: collect(inner, depth + 1) }, next: end }
}

function markerOf(line) {
  const indent = indentOf(line)
  const body = line.slice(indent)
  const gap = (at) => body[at] === SPACE || body[at] === TAB
  if (BULLETS.includes(body[0]) && gap(1)) return { ordered: false, number: 1, indent, offset: indent + 2 }
  const digits = runOfAny(body, DIGITS)
  const isNumbered = digits > 0 && digits <= MAX_NUMBER_DIGITS && ORDERED_ENDS.includes(body[digits]) && gap(digits + 1)
  return isNumbered ? { ordered: true, number: Number(body.slice(0, digits)), indent, offset: indent + digits + 2 } : null
}

function runOfAny(text, allowed) {
  let size = 0
  while (size < text.length && allowed.includes(text[size])) size += 1
  return size
}

const startsBlock = (line) => Boolean(fenceOf(line) || headingOf(line) || isRule(line) || isQuote(line) || markerOf(line))

const dedent = (line, width) => line.slice(Math.min(indentOf(line), width))

function readItem(lines, index, marker) {
  const content = [lines[index].slice(marker.offset)]
  let cursor = index + 1
  while (cursor < lines.length) {
    const resume = skipBlank(lines, cursor)
    const line = lines[resume]
    const isNested = resume < lines.length && indentOf(line) > marker.indent
    const isLazy = resume === cursor && resume < lines.length && !startsBlock(line)
    if (!isNested && !isLazy) break
    for (let blank = cursor; blank < resume; blank += 1) content.push('')
    content.push(dedent(line, marker.offset))
    cursor = resume + 1
  }
  return { lines: content, next: cursor }
}

function readList(lines, index, depth) {
  const first = markerOf(lines[index])
  if (!first || depth >= MAX_BLOCK_DEPTH) return null
  const items = []
  let cursor = index
  while (cursor < lines.length) {
    const marker = markerOf(lines[cursor])
    if (!marker || marker.ordered !== first.ordered || marker.indent > first.indent) break
    const item = readItem(lines, cursor, marker)
    items.push({ blocks: collect(item.lines, depth + 1) })
    cursor = skipBlank(lines, item.next)
  }
  return { block: { type: LIST, ordered: first.ordered, start: first.number, items }, next: cursor }
}

function splitRow(line) {
  let row = line.trim()
  if (row.startsWith(CELL_SEPARATOR)) row = row.slice(1)
  if (row.endsWith(CELL_SEPARATOR)) row = row.slice(0, -1)
  return row.split(CELL_SEPARATOR).map((cell) => cell.trim())
}

function isDelimiterCell(cell) {
  const start = cell.startsWith(ALIGN_MARK) ? 1 : 0
  const end = cell.length > start && cell.endsWith(ALIGN_MARK) ? cell.length - 1 : cell.length
  const dashes = cell.slice(start, end)
  return dashes !== '' && dashes.replaceAll(DASH, '') === ''
}

function fitRow(cells, width) {
  return Array.from({ length: width }, (_, column) => parseInline(cells[column] ?? ''))
}

function readTable(lines, index) {
  const header = lines[index]
  if (!header.includes(CELL_SEPARATOR) || index + 1 >= lines.length) return null
  const heads = splitRow(header)
  const delimiter = splitRow(lines[index + 1])
  if (delimiter.length !== heads.length || !delimiter.every(isDelimiterCell)) return null
  let end = index + 2
  while (end < lines.length && !isBlank(lines[end]) && lines[end].includes(CELL_SEPARATOR)) end += 1
  const rows = lines.slice(index + 2, end).map((line) => fitRow(splitRow(line), heads.length))
  return { block: { type: TABLE, head: fitRow(heads, heads.length), rows }, next: end }
}

function readParagraph(lines, index) {
  let end = index + 1
  while (end < lines.length && !isBlank(lines[end]) && !startsBlock(lines[end])) end += 1
  const text = lines.slice(index, end).join(NEWLINE)
  return { block: { type: PARAGRAPH, children: parseInline(text) }, next: end }
}

const READERS = [readFence, readHeading, readRule, readQuote, readList, readTable, readParagraph]

function readBlock(lines, index, depth) {
  for (const reader of READERS) {
    const result = reader(lines, index, depth)
    if (result) return result
  }
  return null
}

function collect(lines, depth) {
  const blocks = []
  let index = skipBlank(lines, 0)
  while (index < lines.length) {
    const { block, next } = readBlock(lines, index, depth)
    blocks.push(block)
    index = skipBlank(lines, next)
  }
  return blocks
}

export const parseBlocks = (source) => collect(source.split(NEWLINE), 0)
