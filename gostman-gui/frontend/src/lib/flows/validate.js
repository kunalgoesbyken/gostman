import { FLOW_ENGINE_TEXT as TEXT, FLOW_FIELD_TEXT, FLOW_KIND_TEXT } from '../flowsText'
import { isActiveAssertion } from '../scripting/assertions'
import {
  CONDITION_RESPONSE, END_TARGET, MAX_FLOW_DEPTH, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_KINDS, STEP_REPEAT, STEP_REQUEST, STEP_SET,
  STEP_SWITCH, casePosition, indexSteps, isCaseField, loopsAround, normalizeFlow, targetsOf, walkSteps,
} from './model'

const PATH_SEPARATOR = '/'
const REACH_FINE = 'fine'
const REACH_CYCLE = 'cycle'
const REACH_DEEP = 'deep'

const lastSegment = (path) => path.slice(path.lastIndexOf(PATH_SEPARATOR) + 1)

const uniqueMatch = (items, matches) => {
  const found = items.filter(matches)
  return found.length === 1 ? found[0] : null
}

export function resolveRequest(step, requests) {
  if (step.requestId) {
    const byId = requests.find((request) => request.id === step.requestId)
    if (byId) return byId
  }
  if (!step.request) return null
  return uniqueMatch(requests, (request) => request.path === step.request)
    || uniqueMatch(requests, (request) => request.name === step.request)
}

export function resolveFlow(step, flows) {
  if (step.flowId) {
    const byId = flows.find((flow) => flow.id === step.flowId)
    if (byId) return byId
  }
  if (!step.flow) return null
  return uniqueMatch(flows, (flow) => flow.name === step.flow)
}

export const kindText = (kind) => FLOW_KIND_TEXT[kind] || FLOW_KIND_TEXT.unknown

export const caseLabel = (kase, position) => kase.label.trim() || TEXT.caseName(position)

export function stepTitle(step, requests = [], flows = []) {
  if (step.label.trim() !== '') return step.label.trim()
  if (step.kind === STEP_FLOW) return resolveFlow(step, flows)?.name || step.flow || kindText(step.kind).label
  if (step.kind !== STEP_REQUEST) return kindText(step.kind).label
  const request = resolveRequest(step, requests)
  if (request) return request.name
  return step.request ? lastSegment(step.request) : kindText(step.kind).label
}

export function fieldText(step, field) {
  if (isCaseField(field)) return FLOW_FIELD_TEXT.case(caseLabel(step.cases[casePosition(field)], casePosition(field)))
  if (step.kind === STEP_SWITCH && field === 'else') return FLOW_FIELD_TEXT.otherwise
  return FLOW_FIELD_TEXT[field]
}

const isRequestStep = (index, id) => index.get(id)?.step.kind === STEP_REQUEST

function targetProblems(index, step) {
  const around = loopsAround(index, step.id)
  return targetsOf(step).flatMap(([field, target]) => {
    if (target === END_TARGET) return []
    if (!index.has(target)) return [TEXT.unknownTarget(fieldText(step, field), target)]
    const isReachable = loopsAround(index, target).every((loop) => around.includes(loop))
    return isReachable ? [] : [TEXT.intoLoop(fieldText(step, field), target)]
  })
}

const referenceProblem = (index, id) => (id && !isRequestStep(index, id) ? [TEXT.notRequestStep(id)] : [])

const responseReference = (step, index) => (step.source === CONDITION_RESPONSE ? referenceProblem(index, step.step) : [])

const hasConditions = (conditions) => conditions.some(isActiveAssertion)

function valueProblems(index, value) {
  if (value.name === '') return [TEXT.noName]
  if (value.value !== undefined) return []
  if (!value.step) return [TEXT.noValueStep(value.name)]
  if (!isRequestStep(index, value.step)) return [TEXT.notRequestStep(value.step)]
  return value.source === 'body' && value.path === '' ? [TEXT.noSource(value.name)] : []
}

const caseProblems = (step) => step.cases.flatMap((kase, position) => (hasConditions(kase.conditions) ? [] : [TEXT.caseNoConditions(caseLabel(kase, position))]))

function flowSteps(flow) {
  const found = []
  walkSteps(flow.steps, (step) => {
    if (step.kind === STEP_FLOW) found.push(step)
  })
  return found
}

function reach(flowId, scope, path) {
  if (path.includes(flowId)) return REACH_CYCLE
  if (path.length > MAX_FLOW_DEPTH) return REACH_DEEP
  const flow = scope.flowsById.get(flowId)
  if (!flow) return REACH_FINE
  for (const step of flowSteps(normalizeFlow(flow))) {
    const called = resolveFlow(step, scope.flows)
    const reached = called ? reach(called.id, scope, [...path, flowId]) : REACH_FINE
    if (reached !== REACH_FINE) return reached
  }
  return REACH_FINE
}

function flowProblems(step, scope) {
  if (!step.flow && !step.flowId) return [TEXT.noFlow]
  const called = resolveFlow(step, scope.flows)
  if (!called) return [TEXT.missingFlow(step.flow || step.flowId)]
  const reached = reach(called.id, scope, [scope.flow.id])
  if (reached === REACH_CYCLE) return [TEXT.flowCycle(called.name)]
  return reached === REACH_DEEP ? [TEXT.flowTooDeep(MAX_FLOW_DEPTH)] : []
}

const KIND_PROBLEMS = {
  [STEP_REQUEST]: (step, { requests }) => {
    if (!step.request && !step.requestId) return [TEXT.noRequest]
    return resolveRequest(step, requests) ? [] : [TEXT.missingRequest(step.request || step.requestId)]
  },
  [STEP_SET]: (step, { index }) => step.values.flatMap((value) => valueProblems(index, value)),
  [STEP_IF]: (step, { index }) => [
    ...(hasConditions(step.conditions) ? [] : [TEXT.noConditions]),
    ...responseReference(step, index),
  ],
  [STEP_SWITCH]: (step, { index }) => [
    ...(step.cases.length > 0 ? caseProblems(step) : [TEXT.noCases]),
    ...responseReference(step, index),
  ],
  [STEP_FOR_EACH]: (step, { index }) => [
    ...(step.step ? referenceProblem(index, step.step) : [TEXT.noList]),
    ...(step.path ? [] : [TEXT.noPath]),
    ...(step.steps.length > 0 ? [] : [TEXT.emptyLoop]),
  ],
  [STEP_REPEAT]: (step, { index }) => [
    ...(step.steps.length > 0 ? [] : [TEXT.emptyRepeat]),
    ...(hasConditions(step.until) ? responseReference(step, index) : []),
  ],
  [STEP_FLOW]: flowProblems,
}

function stepProblems(step, scope) {
  if (!STEP_KINDS.includes(step.kind)) return [TEXT.unknownKind(step.kind)]
  const own = KIND_PROBLEMS[step.kind]?.(step, scope) ?? []
  return [...own, ...targetProblems(scope.index, step)]
}

function flowScope(flow, requests, flows) {
  const others = flows.filter((candidate) => candidate.id !== flow.id)
  const known = [flow, ...others]
  return { flow, requests, flows: known, flowsById: new Map(known.map((candidate) => [candidate.id, candidate])), index: indexSteps(flow.steps) }
}

export function validateFlow(flow, requests, flows = []) {
  if (flow.steps.length === 0) return [{ step: '', message: TEXT.noSteps }]
  const scope = flowScope(flow, requests, flows)
  const problems = []
  walkSteps(flow.steps, (step) => {
    stepProblems(step, scope).forEach((message) => problems.push({ step: step.id, message }))
  })
  return problems
}

export function describeProblems(flow, problems, requests, flows) {
  const index = indexSteps(flow.steps)
  const lines = problems.map(({ step, message }) => (step ? TEXT.problem(stepTitle(index.get(step).step, requests, flows), message) : message))
  return [TEXT.cannotRun(problems.length), ...lines].join('\n')
}
