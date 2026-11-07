import { isPlainObject } from './dataUtils'
import { problemOf, typedValue, variableProblems } from './requestVariables'
import { isSentRow, parseRows, serializeRows } from './rows'

export const isShownDespiteHidden = (row) => isSentRow(row) && row.hidden === true && problemOf(row) !== ''

export const isFormField = (row) => (isSentRow(row) && row.hidden !== true) || isShownDespiteHidden(row)

const valueText = (row) => String(row.value ?? '')

const entryFor = (values, row) => {
  const entry = isPlainObject(values) && Object.hasOwn(values, row.key) ? values[row.key] : null
  return isPlainObject(entry) && entry.base === valueText(row) ? entry : null
}

function withFormValue(row, values) {
  const entry = entryFor(values, row)
  return entry ? { ...row, value: entry.value } : row
}

export const formFields = (rows, values) => rows
  .map((row, index) => ({ row, index }))
  .filter(({ row }) => isFormField(row))
  .map(({ row, index }) => ({ index, saved: row, row: withFormValue(row, values) }))

export const hasFormChanges = (rows, values) => formFields(rows, values).some(({ row, saved }) => valueText(row) !== valueText(saved))

export const formValueEntry = (saved, value) => ({ value, base: valueText(saved) })

export function filledRequest(request, values) {
  const rows = parseRows(request.vars)
  const fields = formFields(rows, values)
  const filled = rows.map((row, index) => fields.find((field) => field.index === index)?.row ?? row)
  const shown = fields.map(({ row }) => row)
  return {
    problems: variableProblems(shown),
    request: { ...request, vars: serializeRows(filled), formGiven: Object.fromEntries(shown.map((row) => [row.key, typedValue(row)])) },
  }
}

export function withoutFormGiven(request) {
  if (!request.formGiven) return request
  const { formGiven, ...rest } = request
  return rest
}

export const givenNames = (request) => Object.keys(request.formGiven ?? {})

export function withoutGiven(request, names) {
  const dropped = names.filter((name) => Object.hasOwn(request.formGiven ?? {}, name))
  if (dropped.length === 0) return request
  return { ...request, formGiven: Object.fromEntries(Object.entries(request.formGiven).filter(([name]) => !dropped.includes(name))) }
}

const namesIn = (values) => (Array.isArray(values) ? values : Object.keys(isPlainObject(values) ? values : {}))

export const writtenNames = (writes) => (isPlainObject(writes) ? Object.values(writes).flatMap(namesIn) : [])

export const hasNamedRows = (rows) => rows.some((row) => row.key.trim() !== '')
