import { isPlainObject, parseJSON } from '../dataUtils'
import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import { queryJson } from '../jsonPath'
import { substitutePlaceholders, variableMap } from '../placeholders'
import { evaluateAssertionList, isActiveAssertion, titleOf } from '../scripting/assertions'
import { responseSubject } from '../scripting/subjects'
import { CONDITION_VARIABLES, MATCH_ANY, SOURCE_HEADER, SOURCE_STATUS } from './model'

const RESPONSE_ROOT = 'res.body'

export const asText = (value) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

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

const typedVariables = (variables) => Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, parseJSON(asText(value), value)]))

const quotedName = (name) => `'${name.split('\\').join('\\\\').split("'").join("\\'")}'`

const asVariableCheck = (condition) => ({ ...condition, expression: `${RESPONSE_ROOT}[${quotedName(condition.expression.trim())}]` })

function variableChecks(conditions, variables) {
  const active = conditions.filter(isActiveAssertion)
  const results = evaluateAssertionList(active.map(asVariableCheck), { body: typedVariables(variables) }, variables)
  return results.map(({ passed, message }, position) => ({ name: titleOf(active[position]), passed, message }))
}

export function evaluateConditions(step, subject, variables) {
  const checks = step.source === CONDITION_VARIABLES
    ? variableChecks(step.conditions, variables)
    : evaluateAssertionList(step.conditions, subject || {}, variables)
  const passed = step.match === MATCH_ANY ? checks.some((check) => check.passed) : checks.every((check) => check.passed)
  return { checks, passed: checks.length > 0 && passed }
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
