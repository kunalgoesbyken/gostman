import { isPlainObject } from './dataUtils'
import { isBlankValue, isShownInForm, variableProblems } from './requestVariables'
import { isSentRow, parseRows, rowName, serializeRows } from './rows'
import { resolveLayers, scopeLayers } from './variableScopes'

const givenNames = (request) => (Array.isArray(request.formGiven) ? request.formGiven.map(rowName) : [])

const overriddenNames = (sessionVariables, request) => {
  const given = givenNames(request)
  return Object.keys(sessionVariables || {}).filter((name) => !given.includes(name))
}

export const sentProblems = (request, sessionVariables, resolved) => variableProblems(
  parseRows(request.vars),
  overriddenNames(sessionVariables, request),
  resolved && ((name) => resolved.get(name)?.value),
)

export const problemNames = (problems) => problems.map((problem) => problem.key)

export const isShownDespiteHidden = (row, shownNames) => isSentRow(row) && row.hidden === true && shownNames.includes(row.key)

export const isFormField = (row, shownNames) => isShownInForm(row) || isShownDespiteHidden(row, shownNames)

const valueText = (row) => String(row.value ?? '')

const entryFor = (values, row) => {
  const entry = isPlainObject(values) && Object.hasOwn(values, row.key) ? values[row.key] : null
  return isPlainObject(entry) && entry.base === valueText(row) ? entry : null
}

function withFormValue(row, values) {
  const entry = entryFor(values, row)
  return entry ? { ...row, value: entry.value } : row
}

const formFields = (rows, values, shownNames) => rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => isFormField(row, shownNames))
  .map(({ row, index }) => ({ index, saved: row, row: withFormValue(row, values) }))

export const formValueEntry = (saved, value) => ({ value, base: valueText(saved) })

const leavesSessionValue = (row, sessionVariables) => isBlankValue(row) && Object.hasOwn(sessionVariables || {}, rowName(row))

const resolvedFor = (state, request) => resolveLayers(scopeLayers(state, request))

export function filledForm(state, request, values) {
  const rows = parseRows(request.vars)
  const shownNames = problemNames(sentProblems(request, state.sessionVariables, resolvedFor(state, request)))
  const fields = formFields(rows, values, shownNames)
  const filledRows = rows.map((row, index) => fields.find((field) => field.index === index)?.row ?? row)
  const given = fields.map(({ row }) => row).filter((row) => !leavesSessionValue(row, state.sessionVariables))
  const filled = { ...request, vars: serializeRows(filledRows), formGiven: given }
  return {
    fields,
    isChanged: fields.some(({ row, saved }) => valueText(row) !== valueText(saved)),
    problems: sentProblems(filled, state.sessionVariables, resolvedFor(state, filled)),
    request: filled,
  }
}

export function withoutFormGiven(request) {
  if (!request.formGiven) return request
  const { formGiven, ...rest } = request
  return rest
}

export function withoutGiven(request, names) {
  const given = givenNames(request)
  if (!names.some((name) => given.includes(name))) return request
  return { ...request, formGiven: request.formGiven.filter((row) => !names.includes(rowName(row))) }
}

const namesIn = (values) => (Array.isArray(values) ? values : Object.keys(isPlainObject(values) ? values : {}))

export const writtenNames = (writes) => (isPlainObject(writes) ? Object.values(writes).flatMap(namesIn) : [])

export const hasNamedRows = (rows) => rows.some((row) => rowName(row) !== '')
