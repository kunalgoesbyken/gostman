import { formatList } from './i18n/format'
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

const CHOICE_SEPARATOR = ','
const ROW_BASICS = ['key', 'value', 'enabled']
const BLOCKED_LINE_SEPARATOR = '\n'

const accepted = (value) => ({ ok: true, value })
const rejected = (problem) => ({ ok: false, problem })

export const typeOf = (row) => (VARIABLE_TYPES.includes(row.type) ? row.type : TYPE_NONE)

export const choicesOf = (row) => String(row.choices ?? '').split(CHOICE_SEPARATOR).map((choice) => choice.trim()).filter((choice) => choice !== '')

export const isBlankValue = (row) => String(row.value ?? '').trim() === ''

function readNumber(text, isWhole) {
  const number = Number(text.trim())
  if (!Number.isFinite(number)) return rejected(isWhole ? TYPE_INTEGER : TYPE_NUMBER)
  if (isWhole && !Number.isInteger(number)) return rejected(TYPE_INTEGER)
  return accepted(number)
}

function readBoolean(text) {
  const word = text.trim().toLowerCase()
  if (word === BOOLEAN_TRUE) return accepted(true)
  if (word === BOOLEAN_FALSE) return accepted(false)
  return rejected(TYPE_BOOLEAN)
}

function readJson(text) {
  try {
    return accepted(JSON.parse(text))
  } catch {
    return rejected(TYPE_JSON)
  }
}

function readChoice(text, choices) {
  const chosen = text.trim()
  return choices.length === 0 || choices.includes(chosen) ? accepted(chosen) : rejected(TYPE_ENUM)
}

export function readTyped(row) {
  const type = typeOf(row)
  const text = String(row.value ?? '')
  if (type === TYPE_NONE || type === TYPE_STRING) return accepted(text)
  if (type === TYPE_BOOLEAN) return text.trim() === '' ? accepted(false) : readBoolean(text)
  if (text.trim() === '') return accepted(text)
  if (type === TYPE_NUMBER) return readNumber(text, false)
  if (type === TYPE_INTEGER) return readNumber(text, true)
  if (type === TYPE_JSON) return readJson(text)
  return readChoice(text, choicesOf(row))
}

export function typedValue(row) {
  const read = readTyped(row)
  return read.ok ? read.value : row.value
}

export const variableName = (row) => (String(row.label ?? '').trim() || row.key.trim())

export const isShownInForm = (row) => isSentRow(row) && row.hidden !== true

export const PROBLEM_REQUIRED = 'required'

export const problemOf = (row) => {
  const read = readTyped(row)
  if (!read.ok) return read.problem
  const isMissing = typeOf(row) !== TYPE_BOOLEAN && isBlankValue(row)
  return row.required === true && isMissing ? PROBLEM_REQUIRED : ''
}

export function problemText(row, problem) {
  const name = variableName(row)
  if (problem === TYPE_ENUM) return TEXT.problems.enum({ name, choices: formatList(choicesOf(row), 'disjunction') })
  return TEXT.problems[problem](name)
}

export function variableProblems(rows) {
  return rows.filter(isSentRow).flatMap((row) => {
    const problem = problemOf(row)
    return problem === '' ? [] : [{ key: row.key, problem, message: problemText(row, problem) }]
  })
}

export function blockedMessage(problems) {
  return TEXT.blocked(problems.map((problem) => problem.message).join(BLOCKED_LINE_SEPARATOR))
}

export function requestVariables(text) {
  const rows = parseRows(text)
  const problems = variableProblems(rows)
  const typed = rows.map((row) => (isSentRow(row) ? { ...row, value: typedValue(row) } : row))
  return { vars: serializeRows(typed), message: problems.length > 0 ? blockedMessage(problems) : '' }
}

export function keepRowSettings(previous, next) {
  const unused = [...previous]
  return next.map((row) => {
    const at = unused.findIndex((candidate) => candidate.key === row.key)
    if (at < 0) return row
    const [match] = unused.splice(at, 1)
    const settings = Object.entries(match).filter(([name]) => !ROW_BASICS.includes(name))
    return { ...Object.fromEntries(settings), ...row }
  })
}
