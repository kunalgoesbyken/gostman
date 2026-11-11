import { exactNumbersIn, isJsonNumber, parseExact } from './exactJson'
import { formatList } from './i18n/format'
import { fillPlaceholders, parseVariableMap, placeholderNames, placeholderSources } from './placeholders'
import { REQUEST_VARIABLES_TEXT as TEXT } from './requestVariablesText'
import { isSentRow, parseRows, serializeRows } from './rows'
import { PROMPT_PREFIX, isEngineName, isGeneratedName, isPromptName } from './variableNames'

export const TYPE_NONE = ''
export const TYPE_STRING = 'string'
export const TYPE_NUMBER = 'number'
const TYPE_INTEGER = 'integer'
export const TYPE_BOOLEAN = 'boolean'
export const TYPE_JSON = 'json'
export const TYPE_ENUM = 'enum'

export const VARIABLE_TYPES = [TYPE_NONE, TYPE_STRING, TYPE_NUMBER, TYPE_INTEGER, TYPE_BOOLEAN, TYPE_JSON, TYPE_ENUM]

export const BOOLEAN_TRUE = 'true'
export const BOOLEAN_FALSE = 'false'

export const PROBLEM_REQUIRED = 'required'
const PROBLEM_COMMA = 'numberComma'
const PROBLEM_INTEGER_COMMA = 'integerComma'
const PROBLEM_INEXACT = 'inexact'
const PROBLEM_JSON_INEXACT = 'jsonInexact'
const PROBLEM_SPACES = 'spaces'
const PROBLEM_BOOLEAN_CASE = 'booleanCase'
const PROBLEM_BOOLEAN_EMPTY = 'booleanEmpty'

const CHOICE_SEPARATOR = ','
const ROW_BASICS = ['key', 'value', 'enabled']
const BLOCKED_LINE_SEPARATOR = '\n'

const DECIMAL_COMMA = /^-?\d+,\d+$/u
const FRACTION_OR_EXPONENT = /[.eE]/u

const accepted = (value) => ({ ok: true, value })
const rejected = (problem) => ({ ok: false, problem })

export const typeOf = (row) => (VARIABLE_TYPES.includes(row.type) ? row.type : TYPE_NONE)

const valueText = (row) => String(row.value ?? '')

export const choicesOf = (row) => [...new Set(String(row.choices ?? '').split(CHOICE_SEPARATOR).map((choice) => choice.trim()).filter((choice) => choice !== ''))]

const isBlank = (text) => text.trim() === ''

const isTextType = (type) => type === TYPE_NONE || type === TYPE_STRING

export const isTyped = (row) => !isTextType(typeOf(row))

const significant = (digits) => digits.replace(/\D/gu, '').replace(/^0+/u, '').replace(/0+$/u, '')

const writtenDigits = (text) => significant(text.split(/[eE]/u)[0])

const heldDigits = (number) => significant(Math.abs(number).toExponential().split('e')[0])

const isWholeText = (text) => isJsonNumber(text) && !FRACTION_OR_EXPONENT.test(text)

function isExact(text) {
  const number = Number(text)
  if (isWholeText(text)) return Number.isSafeInteger(number)
  return Number.isFinite(number) && writtenDigits(text) === heldDigits(number)
}

function readNumber(text, isWhole) {
  if (DECIMAL_COMMA.test(text)) return rejected(isWhole ? PROBLEM_INTEGER_COMMA : PROBLEM_COMMA)
  if (!(isWhole ? isWholeText : isJsonNumber)(text)) return rejected(isWhole ? TYPE_INTEGER : TYPE_NUMBER)
  return isExact(text) ? accepted(Number(text)) : rejected(PROBLEM_INEXACT)
}

const isBooleanWord = (text) => text === BOOLEAN_TRUE || text === BOOLEAN_FALSE

function readBoolean(text) {
  if (isBooleanWord(text)) return accepted(text === BOOLEAN_TRUE)
  if (text === '') return rejected(PROBLEM_BOOLEAN_EMPTY)
  return rejected(isBooleanWord(text.toLowerCase()) ? PROBLEM_BOOLEAN_CASE : TYPE_BOOLEAN)
}

const inexactJsonNumber = (text) => exactNumbersIn(parseExact(text)).find((written) => !isExact(written)) ?? ''

function readJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return rejected(TYPE_JSON)
  }
  return inexactJsonNumber(text) === '' ? accepted(parsed) : rejected(PROBLEM_JSON_INEXACT)
}

const readChoice = (text, choices) => (choices.length === 0 || choices.includes(text) ? accepted(text) : rejected(TYPE_ENUM))

const holdsPlaceholder = (text) => placeholderNames(text).length > 0

export const usesCheckbox = (row) => typeOf(row) === TYPE_BOOLEAN && (valueText(row) === '' || isBooleanWord(valueText(row)))

export const usesChoiceList = (row) => {
  const choices = choicesOf(row)
  return typeOf(row) === TYPE_ENUM && choices.length > 0 && (valueText(row) === '' || choices.includes(valueText(row)))
}

function readFilled(row, text) {
  const type = typeOf(row)
  if (isTextType(type)) return accepted(text)
  if (type !== TYPE_JSON && text !== text.trim()) return rejected(PROBLEM_SPACES)
  const isEmpty = text === ''
  if (type === TYPE_BOOLEAN) return readBoolean(text)
  if (type === TYPE_ENUM) return isEmpty ? accepted('') : readChoice(text, choicesOf(row))
  if (isEmpty) return accepted(null)
  if (type === TYPE_NUMBER) return readNumber(text, false)
  if (type === TYPE_INTEGER) return readNumber(text, true)
  return readJson(text)
}

export const sentText = (row) => (typeOf(row) === TYPE_BOOLEAN && valueText(row) === '' ? BOOLEAN_FALSE : valueText(row))

const winnerText = (row, values) => values?.get(row.key) ?? sentText(row)

const answerKey = (name) => PROMPT_PREFIX + name.slice(PROMPT_PREFIX.length).trim()

const valueOf = (values, name) => values.get(isPromptName(name) ? answerKey(name) : name)

const usedText = (row, values) => {
  const winner = winnerText(row, values)
  return values ? fillPlaceholders(winner, (name) => valueOf(values, name)) : winner
}

const isUnresolved = (values, name) => values.has(name) && values.get(name) === undefined

const isPending = (text, values) => placeholderNames(text).some((name) => !values || isEngineName(name) || isUnresolved(values, name))

const readUsed = (row, text, values) => (isPending(text, values) ? accepted(text) : readFilled(row, text))

function requiredText(winner, values) {
  if (!values) return winner
  return fillPlaceholders(winner, (name) => valueOf(values, name) ?? (isUnresolved(values, name) || isEngineName(name) ? undefined : ''))
}

const isMissing = (row, values) => row.required === true && typeOf(row) !== TYPE_BOOLEAN && isBlank(requiredText(winnerText(row, values), values))

export function typedValue(row, values) {
  const text = usedText(row, values)
  const read = readUsed(row, text, values)
  return read.ok ? read.value : text
}

export const declaredValues = (rows, values) => Object.fromEntries(
  rows.filter((row) => isSentRow(row) && isTyped(row)).map((row) => [row.key, typedValue(row, values)])
)

export const variableName = (row) => (String(row.label ?? '').trim() || row.key.trim())

export const isShownInForm = (row) => isSentRow(row) && row.hidden !== true

export function problemOf(row, values) {
  if (isMissing(row, values)) return PROBLEM_REQUIRED
  const read = readUsed(row, usedText(row, values), values)
  return read.ok ? '' : read.problem
}

function filledProblemText(row, text, problem, name = variableName(row)) {
  if (problem === TYPE_ENUM) return TEXT.problems.enum({ name, choices: formatList(choicesOf(row), 'disjunction') })
  if (problem === PROBLEM_JSON_INEXACT) return TEXT.problems.jsonInexact({ name, number: inexactJsonNumber(text) })
  return TEXT.problems[problem](name)
}

export function problemText(row, problem, values) {
  const winner = winnerText(row, values)
  const said = filledProblemText(row, usedText(row, values), problem)
  if (winner !== sentText(row)) return TEXT.replaced(said)
  return values && holdsPlaceholder(winner) ? TEXT.fromReference({ problem: said, written: winner.trim() }) : said
}

const feederListType = (problem) => (problem === PROBLEM_REQUIRED ? 'disjunction' : 'conjunction')

export const relayedProblemText = (row, problem, feederNames, values) => (
  filledProblemText(row, usedText(row, values), problem, formatList(feederNames, feederListType(problem)))
)

export function variableProblems(rows, values) {
  return rows.filter(isSentRow).flatMap((row) => {
    const problem = problemOf(row, values)
    return problem === '' ? [] : [{ key: row.key, problem, message: problemText(row, problem, values) }]
  })
}

export function blockedMessage(problems) {
  return TEXT.blocked(problems.map((problem) => problem.message).join(BLOCKED_LINE_SEPARATOR))
}

const generatedIn = (text) => placeholderNames(text).filter(isGeneratedName)

const waitsFor = (candidate, keys) => placeholderSources(candidate.written).some((name) => name !== candidate.key && keys.has(name))

export function generationsFor(rows, values) {
  const candidates = rows
    .filter((row) => isSentRow(row) && isTyped(row) && winnerText(row, values) === sentText(row))
    .map((row) => ({ key: row.key, written: winnerText(row, values), text: usedText(row, values) }))
    .map((candidate) => ({ ...candidate, placeholders: generatedIn(candidate.text).map((name) => `{{${name}}}`) }))
    .filter(({ placeholders }) => placeholders.length > 0)
  const keys = new Set(candidates.map(({ key }) => key))
  return candidates.filter((candidate) => !waitsFor(candidate, keys))
}

export function generatedTexts(pending, expanded) {
  const values = [...expanded]
  const filled = (text) => fillPlaceholders(text, (name) => (isGeneratedName(name) ? values.shift() : undefined))
  return Object.fromEntries(pending.map(({ key, text }) => [key, filled(text)]))
}

const answeredByName = (values) => new Map([...values, ...Array.from(values, ([name, value]) => [PROMPT_PREFIX + name, value])])

const valuesIn = (known) => answeredByName(parseVariableMap(known) ?? new Map())

export const pendingGenerations = (text, known) => generationsFor(parseRows(text), valuesIn(known))

export const declaredVariables = (text, known) => declaredValues(parseRows(text), valuesIn(known))

export function variableMessage(text, known) {
  const problems = variableProblems(parseRows(text), valuesIn(known))
  return problems.length > 0 ? blockedMessage(problems) : ''
}

export function sentVariables(text, generated = {}) {
  const rows = parseRows(text)
  const sent = (row) => (Object.hasOwn(generated, row.key) ? generated[row.key] : sentText(row))
  const sentRows = rows.map((row) => (isSentRow(row) ? { ...row, value: sent(row) } : row))
  return sentRows.some((row, index) => row.value !== rows[index].value) ? serializeRows(sentRows) : text
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
