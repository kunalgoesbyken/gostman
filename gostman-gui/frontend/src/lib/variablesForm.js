import { isPlainObject } from './dataUtils'
import { placeholderSources } from './placeholders'
import { isShownInForm, sentText, variableProblems } from './requestVariables'
import { isSentRow, parseRows, rowName, serializeRows } from './rows'
import { checkValues, resolveLayers, scopeLayers } from './variableScopes'

const givenNames = (request) => (Array.isArray(request.formGiven) ? request.formGiven : [])

export const sentProblems = (request, resolved) => variableProblems(parseRows(request.vars), checkValues(resolved))

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

const winningRow = (row, resolved) => {
  const winner = resolved.get(row.key)?.value
  return winner === undefined || winner === sentText(row) ? row : { ...row, value: winner }
}

const displayedRow = (row, shownNames, resolved) => (isShownDespiteHidden(row, shownNames) ? winningRow(row, resolved) : row)

const formFields = (rows, values, shownNames, resolved) => rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => isFormField(row, shownNames))
  .map(({ row, index }) => {
    const saved = displayedRow(row, shownNames, resolved)
    return { index, saved, row: withFormValue(saved, values) }
  })

export const formValueEntry = (saved, value) => ({ value, base: valueText(saved) })

export const currentFormValues = (values, vars) => Object.fromEntries(
  parseRows(vars).filter((row) => entryFor(values, row)).map((row) => [row.key, values[row.key]])
)

const resolvedFor = (state, request) => resolveLayers(scopeLayers(state, request))

const feedersOf = (text, resolved, keys, seen = new Set()) => placeholderSources(text).flatMap((name) => {
  if (seen.has(name)) return []
  seen.add(name)
  return keys.includes(name) ? [name] : feedersOf(resolved.get(name)?.value ?? '', resolved, keys, seen)
})

const feedersOfProblem = ({ key }, resolved, keys) => (keys.includes(key) ? [key] : feedersOf(resolved.get(key)?.value ?? '', resolved, keys))

export function hiddenNamesShown(request, resolved) {
  const visibleKeys = parseRows(request.vars).filter(isShownInForm).map((row) => row.key)
  return sentProblems(request, resolved)
    .filter((problem) => feedersOfProblem(problem, resolved, visibleKeys).length === 0)
    .map((problem) => problem.key)
}

function fieldProblems(problems, resolved, fieldKeys) {
  const own = problems.filter((problem) => fieldKeys.includes(problem.key))
  const fed = problems
    .filter((problem) => !fieldKeys.includes(problem.key))
    .flatMap((problem) => feedersOfProblem(problem, resolved, fieldKeys).map((key) => ({ ...problem, key })))
  return [...own, ...fed]
}

const givenRequest = (request, rows, fields) => ({
  ...request,
  vars: serializeRows(rows.map((row, index) => fields.find((field) => field.index === index)?.row ?? row)),
  formGiven: fields.map(({ row }) => row.key),
})

export function filledForm(state, request, values) {
  const rows = parseRows(request.vars)
  const savedResolved = resolvedFor(state, request)
  const visible = givenRequest(request, rows, formFields(rows, values, [], savedResolved))
  const shownNames = hiddenNamesShown(visible, resolvedFor(state, visible))
  const fields = formFields(rows, values, shownNames, savedResolved)
  const filled = givenRequest(request, rows, fields)
  const resolved = resolvedFor(state, filled)
  return {
    fields,
    isChanged: fields.some(({ row, saved }) => valueText(row) !== valueText(saved)),
    problems: fieldProblems(sentProblems(filled, resolved), resolved, fields.map(({ row }) => row.key)),
    request: filled,
  }
}

export function withoutFormGiven(request) {
  if (!request.formGiven) return request
  const { formGiven, ...rest } = request
  return rest
}

export function withoutGiven(request, names) {
  if (!names.some((name) => givenNames(request).includes(name))) return request
  return { ...request, formGiven: request.formGiven.filter((name) => !names.includes(name)) }
}

const namesIn = (values) => (Array.isArray(values) ? values : Object.keys(isPlainObject(values) ? values : {}))

export const writtenNames = (writes) => (isPlainObject(writes) ? Object.values(writes).flatMap(namesIn) : [])

export const hasNamedRows = (rows) => rows.some((row) => rowName(row) !== '')
