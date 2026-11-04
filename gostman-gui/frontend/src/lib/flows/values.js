import { isPlainObject, parseJSON } from '../dataUtils'
import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import { queryJson } from '../jsonPath'
import { substitutePlaceholders, variableMap } from '../placeholders'
import { evaluateAssertionList, isActiveAssertion, titleOf } from '../scripting/assertions'
import { responseSubject } from '../scripting/subjects'
import { MATCH_ANY, isGroup } from './conditions'
import { typedValue } from './declared'
import { CONDITION_VARIABLES, SOURCE_HEADER, SOURCE_STATUS } from './model'

const RESPONSE_ROOT = 'res.body'

export const asText = (value) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export const withoutNames = (values, names) => Object.fromEntries(Object.entries(values).filter(([name]) => !names.includes(name)))

export const subjectOf = (response) => (isPlainObject(response) ? responseSubject({ headers: [], body: '', ...response }) : {})

const failure = (message) => ({ ok: false, message })

const success = (value) => ({ ok: true, value })

const jsonPathOf = (path) => (path.startsWith('$') ? path : `$.${path}`)

function readBody(subject, path, title) {
  try {
    const found = queryJson(jsonPathOf(path), subject.body)
    return found === undefined ? failure(TEXT.nothingFound(path, title)) : success(found)
  } catch (error) {
    return failure(error.message)
  }
}

function readHeader(subject, name, title) {
  const found = subject.headers?.[name.toLowerCase()]
  return found === undefined ? failure(TEXT.noHeader(name, title)) : success(found)
}

export function readResponse(subject, { source, path }, title) {
  if (!subject) return failure(TEXT.notRunYet(title))
  if (source === SOURCE_STATUS) return success(subject.status)
  if (source === SOURCE_HEADER) return readHeader(subject, path, title)
  return readBody(subject, path, title)
}

export const fillTemplate = (template, variables) => substitutePlaceholders(template, variableMap(variables))

const typedVariables = (variables, types) => Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, typedValue(asText(value), types[name])]))

const quotedName = (name) => `'${name.split('\\').join('\\\\').split("'").join("\\'")}'`

const asVariableCheck = (condition) => ({ ...condition, expression: `${RESPONSE_ROOT}[${quotedName(condition.expression.trim())}]` })

function variableChecks(conditions, variables, types) {
  const active = conditions.filter(isActiveAssertion)
  const results = evaluateAssertionList(active.map(asVariableCheck), { body: typedVariables(variables, types) }, variables)
  return results.map(({ passed, message }, position) => ({ name: titleOf(active[position]), passed, message }))
}

const leafChecks = (source, leaves, subject, variables, types) => (
  source === CONDITION_VARIABLES ? variableChecks(leaves, variables, types) : evaluateAssertionList(leaves, subject || {}, variables)
)

const inGroup = (match) => (check) => ({ ...check, name: TEXT.inGroup(match, check.name) })

function judge(match, items, read) {
  const own = read(items.filter((item) => !isGroup(item)))
  const groups = items.filter(isGroup).map((group) => judge(group.match, group.conditions, read)).filter((group) => group.counted)
  const verdicts = [...own.map((check) => check.passed), ...groups.map((group) => group.passed)]
  const passed = match === MATCH_ANY ? verdicts.some(Boolean) : verdicts.every(Boolean)
  const nested = groups.flatMap((group) => group.checks.map(inGroup(group.match)))
  return { match, counted: verdicts.length > 0, passed: verdicts.length > 0 && passed, checks: [...own, ...nested] }
}

export function evaluateConditions(step, subject, variables, types = {}) {
  const read = (leaves) => leafChecks(step.source, leaves, subject, variables, types)
  const { checks, passed } = judge(step.match, step.conditions, read)
  return { checks, passed }
}

export const evaluateUntil = (conditions, subject, variables) => evaluateAssertionList(conditions, subject, variables)

export function listItems(subject, path, title) {
  const read = readResponse(subject, { path }, title)
  if (!read.ok) return read
  return Array.isArray(read.value) ? read : failure(TEXT.notAList(path, title))
}

export function itemValues(item, index, names) {
  const values = { [names.as]: asText(item), [names.indexAs]: String(index) }
  if (!isPlainObject(item)) return values
  Object.entries(item).forEach(([key, value]) => {
    values[`${names.as}.${key}`] = asText(value)
  })
  return values
}
