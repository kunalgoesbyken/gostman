import { formatList } from './i18n/format'
import { fillPlaceholders, parseVariableMap, placeholderNames } from './placeholders'
import { REQUEST_VARIABLES_TEXT as TEXT } from './requestVariablesText'
import { isSentRow, parseRows, serializeRows } from './rows'

export const TYPE_NONE = ''
export const TYPE_STRING = 'string'
export const TYPE_NUMBER = 'number'
export const TYPE_INTEGER = 'integer'
export const TYPE_BOOLEAN = 'boolean'
export const TYPE_JSON = 'json'
export const TYPE_ENUM = 'enum'

export const VARIABLE_TYPES = [TYPE_NONE, TYPE_STRING, TYPE_NUMBER, TYPE_INTEGER, TYPE_BOOLEAN, TYPE_JSON, TYPE_ENUM]

export const BOOLEAN_TRUE = 'true'
export const BOOLEAN_FALSE = 'false'

export const PROBLEM_REQUIRED = 'required'
export const PROBLEM_COMMA = 'numberComma'
export const PROBLEM_INEXACT = 'inexact'
export const PROBLEM_JSON_INEXACT = 'jsonInexact'

const CHOICE_SEPARATOR = ','
const ROW_BASICS = ['key', 'value', 'enabled']
const BLOCKED_LINE_SEPARATOR = '\n'

const DECIMAL = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/u
const WHOLE = /^-?\d+$/u
const DECIMAL_COMMA = /^-?\d+,\d+$/u
const JSON_NUMBER = /-?\d+(\.\d+)?([eE][+-]?\d+)?/uy
const NUMBER_START = /[-\d]/u
const QUOTE = '"'
const ESCAPE = '\\'

const accepted = (value) => ({ ok: true, value })
const rejected = (problem) => ({ ok: false, problem })

export const typeOf = (row) => (VARIABLE_TYPES.includes(row.type) ? row.type : TYPE_NONE)

export const choicesOf = (row) => String(row.choices ?? '').split(CHOICE_SEPARATOR).map((choice) => choice.trim()).filter((choice) => choice !== '')

export const isBlankValue = (row) => String(row.value ?? '').trim() === ''

const isTextType = (type) => type === TYPE_NONE || type === TYPE_STRING

const significant = (digits) => digits.replace(/\D/gu, '').replace(/^0+/u, '').replace(/0+$/u, '')

const writtenDigits = (text) => significant(text.split(/[eE]/u)[0])

const heldDigits = (number) => significant(Math.abs(number).toExponential().split('e')[0])

const isPlainInteger = (text) => WHOLE.test(text)

const isExact = (text, number) => (
  isPlainInteger(text) ? Number.isSafeInteger(number) : Number.isFinite(number) && writtenDigits(text) === heldDigits(number)
)

function readNumber(text, isWhole) {
  const written = text.trim()
  if (DECIMAL_COMMA.test(written)) return rejected(PROBLEM_COMMA)
  if (!(isWhole ? WHOLE : DECIMAL).test(written)) return rejected(isWhole ? TYPE_INTEGER : TYPE_NUMBER)
  const number = Number(written)
  return isExact(written, number) ? accepted(number) : rejected(PROBLEM_INEXACT)
}

const isBooleanWord = (text) => [BOOLEAN_TRUE, BOOLEAN_FALSE].includes(text.trim().toLowerCase())

const readBoolean = (text) => (isBooleanWord(text) ? accepted(text.trim().toLowerCase() === BOOLEAN_TRUE) : rejected(TYPE_BOOLEAN))

function afterString(text, start) {
  let index = start + 1
  while (index < text.length && text[index] !== QUOTE) index += text[index] === ESCAPE ? 2 : 1
  return index + 1
}

export function inexactJsonNumber(text) {
  let index = 0
  while (index < text.length) {
    if (text[index] === QUOTE) {
      index = afterString(text, index)
      continue
    }
    if (!NUMBER_START.test(text[index])) {
      index += 1
      continue
    }
    JSON_NUMBER.lastIndex = index
    const written = JSON_NUMBER.exec(text)?.[0] ?? text[index]
    if (!isExact(written, Number(written))) return written
    index += written.length
  }
  return ''
}

function readJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return rejected(TYPE_JSON)
  }
  return inexactJsonNumber(text) === '' ? accepted(parsed) : rejected(PROBLEM_JSON_INEXACT)
}

function readChoice(text, choices) {
  const chosen = text.trim()
  return choices.length === 0 || choices.includes(chosen) ? accepted(chosen) : rejected(TYPE_ENUM)
}

export const holdsPlaceholder = (text) => placeholderNames(String(text ?? '')).length > 0

export const isTypedReference = (row) => !isTextType(typeOf(row)) && holdsPlaceholder(row.value)

export const usesCheckbox = (row) => typeOf(row) === TYPE_BOOLEAN && (isBlankValue(row) || isBooleanWord(String(row.value)))

export const usesChoiceList = (row) => {
  const choices = choicesOf(row)
  return typeOf(row) === TYPE_ENUM && choices.length > 0 && (isBlankValue(row) || choices.includes(String(row.value).trim()))
}

function readFilled(row, text) {
  const type = typeOf(row)
  if (isTextType(type)) return accepted(text)
  const isEmpty = text.trim() === ''
  if (type === TYPE_BOOLEAN) return isEmpty ? accepted(false) : readBoolean(text)
  if (type === TYPE_ENUM) return isEmpty ? accepted('') : readChoice(text, choicesOf(row))
  if (isEmpty) return accepted(null)
  if (type === TYPE_NUMBER) return readNumber(text, false)
  if (type === TYPE_INTEGER) return readNumber(text, true)
  return readJson(text)
}

const filledText = (row, valueOf) => {
  const text = String(row.value ?? '')
  return valueOf && isTypedReference(row) ? fillPlaceholders(text, valueOf) : text
}

const isDeferred = (row, valueOf) => !valueOf && isTypedReference(row)

export function readTyped(row, valueOf) {
  return isDeferred(row, valueOf) ? accepted(String(row.value)) : readFilled(row, filledText(row, valueOf))
}

export function typedValue(row, valueOf) {
  const read = readTyped(row, valueOf)
  return read.ok ? read.value : String(row.value ?? '')
}

export const sentText = (row) => (typeOf(row) === TYPE_BOOLEAN && isBlankValue(row) ? BOOLEAN_FALSE : String(row.value ?? ''))

export const variableName = (row) => (String(row.label ?? '').trim() || row.key.trim())

export const isShownInForm = (row) => isSentRow(row) && row.hidden !== true

function filledProblem(row, text) {
  const read = readFilled(row, text)
  if (!read.ok) return read.problem
  const isMissing = typeOf(row) !== TYPE_BOOLEAN && text.trim() === ''
  return row.required === true && isMissing ? PROBLEM_REQUIRED : ''
}

export const problemOf = (row, valueOf) => (isDeferred(row, valueOf) ? '' : filledProblem(row, filledText(row, valueOf)))

function filledProblemText(row, text, problem) {
  const name = variableName(row)
  if (problem === TYPE_ENUM) return TEXT.problems.enum({ name, choices: formatList(choicesOf(row), 'disjunction') })
  if (problem === PROBLEM_JSON_INEXACT) return TEXT.problems.jsonInexact({ name, number: inexactJsonNumber(text) })
  return TEXT.problems[problem](name)
}

export function problemText(row, problem, valueOf) {
  const said = filledProblemText(row, filledText(row, valueOf), problem)
  return valueOf && isTypedReference(row) ? TEXT.fromReference({ problem: said, written: String(row.value).trim() }) : said
}

export function variableProblems(rows, overridden = [], valueOf = undefined) {
  return rows.filter((row) => isSentRow(row) && !overridden.includes(row.key)).flatMap((row) => {
    const problem = problemOf(row, valueOf)
    return problem === '' ? [] : [{ key: row.key, problem, message: problemText(row, problem, valueOf) }]
  })
}

export function blockedMessage(problems) {
  return TEXT.blocked(problems.map((problem) => problem.message).join(BLOCKED_LINE_SEPARATOR))
}

export function requestVariables(text, overridden = [], known = '') {
  const rows = parseRows(text)
  const values = parseVariableMap(known) ?? new Map()
  const valueOf = (name) => values.get(name)
  const problems = variableProblems(rows, overridden, valueOf)
  return {
    vars: serializeRows(rows.map((row) => (isSentRow(row) ? { ...row, value: sentText(row) } : row))),
    typed: Object.fromEntries(rows.filter(isSentRow).map((row) => [row.key, typedValue(row, valueOf)])),
    message: problems.length > 0 ? blockedMessage(problems) : '',
  }
}

const settingsOf = (row) => Object.fromEntries(Object.entries(row).filter(([name]) => !ROW_BASICS.includes(name)))

export function keepRowSettings(previous, next) {
  const nextKeys = new Set(next.map((row) => row.key))
  const unused = [...previous]
  const matchFor = (row, index) => {
    const sameKey = unused.find((candidate) => candidate.key === row.key)
    if (sameKey) return sameKey
    const renamed = previous[index]
    return renamed && !nextKeys.has(renamed.key) && unused.includes(renamed) ? renamed : undefined
  }
  return next.map((row, index) => {
    const match = matchFor(row, index)
    if (!match) return row
    unused.splice(unused.indexOf(match), 1)
    return { ...settingsOf(match), ...row }
  })
}
