import { RESPONSE_CHECKS_TEXT } from './checksText'
import { isUsableResponse } from './chaining'
import { inferSchema } from './schemaInference'
import { BLANK_ASSERTION, SCHEMA_OPERATOR, isKnownAssertion, withAddedAssertions } from './scripting/assertions'
import { responseSubject } from './scripting/subjects'
import { selectActiveTab, useAppStore } from '../store/appStore'

const BUDGET_STEP_MS = 100
const BUDGET_FACTOR = 2
const MIN_BUDGET_MS = 200
const CONTENT_TYPE = 'content-type'

const store = () => useAppStore.getState()

const assertion = (expression, operator, value) => ({ ...BLANK_ASSERTION, expression, operator, value: String(value) })

const budgetFor = (milliseconds) => Math.max(MIN_BUDGET_MS, Math.ceil((milliseconds * BUDGET_FACTOR) / BUDGET_STEP_MS) * BUDGET_STEP_MS)

const isJsonValue = (body) => body !== null && typeof body === 'object'

export const canProposeChecks = (response) => isUsableResponse(response) && !response.protocol && response.statusCode > 0

export function proposeChecks(response) {
  const subject = responseSubject(response)
  const contentType = String(subject.headers[CONTENT_TYPE] ?? '').split(';')[0].trim()
  const budget = budgetFor(subject.responseTime || 0)
  return [
    { id: 'status', description: RESPONSE_CHECKS_TEXT.kinds.status, assertion: assertion('res.status', 'eq', subject.status), isSuggested: true },
    contentType && { id: 'contentType', description: RESPONSE_CHECKS_TEXT.kinds.contentType, assertion: assertion(`res.headers.${CONTENT_TYPE}`, 'contains', contentType), isSuggested: true },
    isJsonValue(subject.body) && { id: 'schema', description: RESPONSE_CHECKS_TEXT.kinds.schema, assertion: assertion('res.body', SCHEMA_OPERATOR, JSON.stringify(inferSchema(subject.body))), isSuggested: true },
    { id: 'responseTime', description: RESPONSE_CHECKS_TEXT.kinds.responseTime(budget), assertion: assertion('res.responseTime', 'lt', budget), isSuggested: false },
  ].filter(Boolean)
}

export const activeAssertions = (state) => selectActiveTab(state)?.request.assertions ?? ''

export const newProposals = (proposals, assertions) => proposals.filter((proposal) => !isKnownAssertion(assertions, proposal.assertion))

export function addChecks(additions) {
  const tab = selectActiveTab(store())
  if (!tab || additions.length === 0) return
  store().updateActiveRequest({ assertions: withAddedAssertions(tab.request.assertions, additions) })
  store().showNotice(RESPONSE_CHECKS_TEXT.added(additions.length, tab.request.name))
}
