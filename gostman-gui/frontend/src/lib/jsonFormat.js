const INDENT = '  '
const MAX_DEPTH = 512
const REFERENCE_OPEN = '{{'
const REFERENCE_CLOSE = '}}'
const WHITESPACE = new Set([' ', '\t', '\n', '\r', '﻿'])
const LITERALS = ['true', 'false', 'null']
const SIMPLE_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't'])
const HEX_DIGIT = /^[0-9a-fA-F]$/
const FIRST_CONTROL = ' '

export const JSON_FORMAT_TEXT = {
  expectedValue: 'Expected a value',
  unexpectedEnd: 'The JSON ends too early',
  unexpected: (character) => `Unexpected ${character}`,
  expectedKey: 'Expected a property name in double quotes',
  expectedColon: "Expected ':' after the property name",
  expectedObjectEnd: "Expected ',' or '}' after the property value",
  expectedArrayEnd: "Expected ',' or ']' after the item",
  trailingComma: (closer) => `Remove the comma before '${closer}'`,
  unclosedString: 'This string has no closing quote',
  lineBreakInString: 'Line breaks inside a string must be written as \\n',
  controlInString: 'Control characters inside a string must be escaped',
  badEscape: 'Unknown escape sequence in a string',
  badNumber: 'This number is not valid JSON',
  unclosedReference: 'This {{variable}} has no closing }}',
  extraText: 'Unexpected text after the JSON value',
  tooDeep: 'The JSON is nested too deeply to format',
}

const TEXT = JSON_FORMAT_TEXT

class JsonProblem extends Error {
  constructor(offset, message) {
    super(message)
    this.offset = offset
  }
}

const isDigit = (character) => character >= '0' && character <= '9'

const describe = (character) => (character === undefined ? 'end of text' : JSON.stringify(character))

function createReader(text) {
  let at = 0
  const fail = (message, offset = at) => {
    throw new JsonProblem(offset, message)
  }
  const peek = () => text[at]
  const skipSpace = () => {
    while (at < text.length && WHITESPACE.has(text[at])) at += 1
  }
  const take = () => text[at++]
  const position = () => at
  const startsWith = (prefix) => text.startsWith(prefix, at)
  const slice = (start) => text.slice(start, at)
  const advance = (count) => {
    at += count
  }
  const isDone = () => at >= text.length
  return { text, fail, peek, skipSpace, take, position, startsWith, slice, advance, isDone }
}

function readReference(reader) {
  const start = reader.position()
  const end = reader.text.indexOf(REFERENCE_CLOSE, start + REFERENCE_OPEN.length)
  if (end === -1) reader.fail(TEXT.unclosedReference, start)
  reader.advance(end + REFERENCE_CLOSE.length - start)
  return reader.slice(start)
}

function readEscape(reader) {
  const escaped = reader.take()
  if (SIMPLE_ESCAPES.has(escaped)) return
  if (escaped !== 'u') reader.fail(TEXT.badEscape, reader.position() - 2)
  for (let digit = 0; digit < 4; digit += 1) {
    if (!HEX_DIGIT.test(reader.peek() ?? '')) reader.fail(TEXT.badEscape, reader.position())
    reader.advance(1)
  }
}

function readString(reader) {
  const start = reader.position()
  reader.advance(1)
  for (;;) {
    if (reader.isDone()) reader.fail(TEXT.unclosedString, start)
    const character = reader.take()
    if (character === '"') return reader.slice(start)
    if (character === '\\') readEscape(reader)
    else if (character === '\n' || character === '\r') reader.fail(TEXT.lineBreakInString, reader.position() - 1)
    else if (character < FIRST_CONTROL) reader.fail(TEXT.controlInString, reader.position() - 1)
  }
}

function readDigits(reader, start) {
  if (!isDigit(reader.peek())) reader.fail(TEXT.badNumber, start)
  while (isDigit(reader.peek())) reader.advance(1)
}

function readNumber(reader) {
  const start = reader.position()
  if (reader.peek() === '-') reader.advance(1)
  if (reader.peek() === '0') reader.advance(1)
  else readDigits(reader, start)
  if (reader.peek() === '.') {
    reader.advance(1)
    readDigits(reader, start)
  }
  if (reader.peek() === 'e' || reader.peek() === 'E') {
    reader.advance(1)
    if (reader.peek() === '+' || reader.peek() === '-') reader.advance(1)
    readDigits(reader, start)
  }
  return reader.slice(start)
}

function readLiteral(reader) {
  const literal = LITERALS.find((candidate) => reader.startsWith(candidate))
  if (!literal) reader.fail(TEXT.unexpected(describe(reader.peek())))
  reader.advance(literal.length)
  return literal
}

const pad = (depth) => INDENT.repeat(depth)

const block = (open, close, lines, depth) => (
  lines.length === 0 ? `${open}${close}` : `${open}\n${lines.map((line) => `${pad(depth + 1)}${line}`).join(',\n')}\n${pad(depth)}${close}`
)

function readKey(reader) {
  if (reader.peek() === '"') return readString(reader)
  if (reader.startsWith(REFERENCE_OPEN)) return readReference(reader)
  return reader.fail(reader.isDone() ? TEXT.unexpectedEnd : TEXT.expectedKey)
}

function readMembers(reader, depth, { closer, readMember, missingEnd }) {
  const lines = []
  reader.advance(1)
  reader.skipSpace()
  if (reader.peek() === closer) {
    reader.advance(1)
    return lines
  }
  for (;;) {
    lines.push(readMember())
    reader.skipSpace()
    const separator = reader.position()
    if (reader.peek() === closer) {
      reader.advance(1)
      return lines
    }
    if (reader.peek() !== ',') reader.fail(reader.isDone() ? TEXT.unexpectedEnd : missingEnd)
    reader.advance(1)
    reader.skipSpace()
    if (reader.peek() === closer) reader.fail(TEXT.trailingComma(closer), separator)
  }
}

function readObject(reader, depth) {
  const readMember = () => {
    const key = readKey(reader)
    reader.skipSpace()
    if (reader.peek() !== ':') reader.fail(reader.isDone() ? TEXT.unexpectedEnd : TEXT.expectedColon)
    reader.advance(1)
    reader.skipSpace()
    return `${key}: ${readValue(reader, depth + 1)}`
  }
  return block('{', '}', readMembers(reader, depth, { closer: '}', readMember, missingEnd: TEXT.expectedObjectEnd }), depth)
}

function readArray(reader, depth) {
  const readMember = () => readValue(reader, depth + 1)
  return block('[', ']', readMembers(reader, depth, { closer: ']', readMember, missingEnd: TEXT.expectedArrayEnd }), depth)
}

function readValue(reader, depth) {
  if (depth > MAX_DEPTH) reader.fail(TEXT.tooDeep)
  reader.skipSpace()
  const character = reader.peek()
  if (character === undefined) return reader.fail(TEXT.unexpectedEnd)
  if (reader.startsWith(REFERENCE_OPEN)) return readReference(reader)
  if (character === '{') return readObject(reader, depth)
  if (character === '[') return readArray(reader, depth)
  if (character === '"') return readString(reader)
  if (character === '-' || isDigit(character)) return readNumber(reader)
  return readLiteral(reader)
}

export function lineAndColumn(text, offset) {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  return { line, column: offset - before.lastIndexOf('\n') }
}

function problemOf(text, error) {
  if (!(error instanceof JsonProblem)) throw error
  return { offset: error.offset, message: error.message, ...lineAndColumn(text, error.offset) }
}

export function formatJson(text) {
  const reader = createReader(text)
  try {
    const formatted = readValue(reader, 0)
    reader.skipSpace()
    if (!reader.isDone()) reader.fail(TEXT.extraText)
    return { text: formatted }
  } catch (error) {
    return { error: problemOf(text, error) }
  }
}

export const findJsonProblem = (text) => formatJson(text).error ?? null
