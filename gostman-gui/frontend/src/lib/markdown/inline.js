import { lookup } from '../dataUtils'
import { BREAK, CODE, EMPHASIS, LINK, STRONG, TEXT } from './nodes'
import { safeUrl } from './urls'

const MAX_DEPTH = 6
const MAX_LABEL = 2000
const MAX_TARGET = 2000
const ESCAPABLE = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
const BACKTICK = '`'
const NEWLINE = '\n'
const BACKSLASH = '\\'
const STAR = '*'
const UNDERSCORE = '_'
const BANG = '!'
const LABEL_OPEN = '['
const LABEL_CLOSE = ']'
const TARGET_OPEN = '('
const TARGET_CLOSE = ')'
const ANGLE_OPEN = '<'
const ANGLE_CLOSE = '>'
const SPACE = ' '
const DIGITS = '0123456789'

const isSpace = (character) => character === undefined || character.trim() === ''

const isWordCharacter = (character) => (
  character !== undefined && (character.toLowerCase() !== character.toUpperCase() || DIGITS.includes(character))
)

const always = () => true

function createState(text, depth) {
  return { text, depth, position: 0, start: 0, nodes: [], found: new Map() }
}

function pushText(state, end) {
  if (end > state.start) state.nodes.push({ type: TEXT, text: state.text.slice(state.start, end) })
}

function emit(state, from, added, end) {
  pushText(state, from)
  added.forEach((node) => state.nodes.push(node))
  state.position = end
  state.start = end
}

function nextMatch(state, mark, from, accepts) {
  const cached = state.found.get(mark)
  if (cached !== undefined && (cached === -1 || cached >= from)) return cached
  let at = state.text.indexOf(mark, from)
  while (at !== -1 && !accepts(at)) at = state.text.indexOf(mark, at + 1)
  state.found.set(mark, at)
  return at
}

function runLength(text, position) {
  let end = position
  while (text[end] === text[position]) end += 1
  return end - position
}

function lineBreak(state) {
  emit(state, state.position, [{ type: BREAK }], state.position + 1)
  return true
}

function escape(state) {
  const { text, position } = state
  const next = text[position + 1]
  if (next === NEWLINE) {
    emit(state, position, [{ type: BREAK }], position + 2)
    return true
  }
  if (next === undefined || !ESCAPABLE.includes(next)) return false
  pushText(state, position)
  state.start = position + 1
  state.position = position + 2
  return true
}

function codeContent(raw) {
  const content = raw.replaceAll(NEWLINE, SPACE)
  const isPadded = content.length > 2 && content.startsWith(SPACE) && content.endsWith(SPACE) && content.trim() !== ''
  return isPadded ? content.slice(1, -1) : content
}

function codeSpan(state) {
  const { text, position } = state
  const size = runLength(text, position)
  const run = BACKTICK.repeat(size)
  const isLoneRun = (at) => text[at - 1] !== BACKTICK && text[at + size] !== BACKTICK
  const close = nextMatch(state, run, position + size, isLoneRun)
  if (close === -1) {
    state.position = position + size
    return true
  }
  emit(state, position, [{ type: CODE, text: codeContent(text.slice(position + size, close)) }], close + size)
  return true
}

function closesEmphasis(text, run) {
  const marker = run[0]
  const isSingle = run.length === 1
  return (at) => {
    const before = text[at - 1]
    if (isSpace(before)) return false
    if (marker === UNDERSCORE && isWordCharacter(text[at + run.length])) return false
    return !isSingle || (before !== marker && text[at + 1] !== marker)
  }
}

function canOpenEmphasis(text, position, open) {
  if (isSpace(text[open])) return false
  return text[position] !== UNDERSCORE || !isWordCharacter(text[position - 1])
}

function emphasis(state) {
  const { text, position, depth } = state
  const marker = text[position]
  const size = text.startsWith(marker + marker, position) ? 2 : 1
  const open = position + size
  if (depth >= MAX_DEPTH || !canOpenEmphasis(text, position, open)) return false
  const run = marker.repeat(size)
  const close = nextMatch(state, run, open, closesEmphasis(text, run))
  if (close <= open) return false
  const node = { type: size === 2 ? STRONG : EMPHASIS, children: parseInline(text.slice(open, close), depth + 1) }
  emit(state, position, [node], close + size)
  return true
}

function targetOf(raw) {
  const target = raw.trim()
  if (target.startsWith(ANGLE_OPEN)) {
    const end = target.indexOf(ANGLE_CLOSE)
    return end === -1 ? target : target.slice(1, end)
  }
  const space = target.indexOf(SPACE)
  return space === -1 ? target : target.slice(0, space)
}

function linkBounds(state, labelStart) {
  const labelEnd = nextMatch(state, LABEL_CLOSE, labelStart, always)
  if (labelEnd === -1 || labelEnd - labelStart > MAX_LABEL || state.text[labelEnd + 1] !== TARGET_OPEN) return null
  const targetEnd = nextMatch(state, TARGET_CLOSE, labelEnd + 2, always)
  if (targetEnd === -1 || targetEnd - labelEnd > MAX_TARGET) return null
  return { labelEnd, targetEnd }
}

function link(state) {
  const { text, position, depth } = state
  const isImage = text[position] === BANG
  if (isImage ? text[position + 1] !== LABEL_OPEN : depth >= MAX_DEPTH) return false
  const labelStart = position + (isImage ? 2 : 1)
  const bounds = linkBounds(state, labelStart)
  if (!bounds) return false
  const label = text.slice(labelStart, bounds.labelEnd)
  const children = isImage ? [{ type: TEXT, text: label }] : parseInline(label, depth + 1)
  const href = safeUrl(targetOf(text.slice(bounds.labelEnd + 2, bounds.targetEnd)))
  emit(state, position, href === null ? children : [{ type: LINK, href, children }], bounds.targetEnd + 1)
  return true
}

const HANDLERS = {
  [BACKSLASH]: escape,
  [NEWLINE]: lineBreak,
  [BACKTICK]: codeSpan,
  [STAR]: emphasis,
  [UNDERSCORE]: emphasis,
  [LABEL_OPEN]: link,
  [BANG]: link,
}

export function parseInline(text, depth = 0) {
  const state = createState(text, depth)
  while (state.position < text.length) {
    const handler = lookup(HANDLERS, text[state.position])
    if (!handler || !handler(state)) state.position += 1
  }
  pushText(state, text.length)
  return state.nodes
}
