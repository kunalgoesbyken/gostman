import { FLOW_ENGINE_TEXT as TEXT, FLOW_FIELD_TEXT, FLOW_KIND_TEXT } from '../flowsText'
import { MAX_GROUP_DEPTH, groupDepth, hasActiveCondition } from './conditions'
import { coerce, declarationOrder, namedDeclared } from './declared'
import { INPUT_BODY, INPUT_FORM, INPUT_TARGETS, acceptsBody, acceptsForm, bodyPath } from './inputs'
import {
  BRANCH_KINDS, CONDITION_RESPONSE, END_TARGET, MAX_FLOW_DEPTH, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_KINDS, STEP_PARALLEL, STEP_REPEAT,
  STEP_REQUEST, STEP_SET, STEP_SWITCH, casePosition, indexSteps, isBranch, isCaseField, loopsAround, normalizeFlow, targetsOf, walkSteps,
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
    if (isReachable) return []
    return isBranch(index, target) ? [TEXT.intoBranch(fieldText(step, field), target)] : [TEXT.intoLoop(fieldText(step, field), target)]
  })
}

const referenceProblem = (index, id) => (id && !isRequestStep(index, id) ? [TEXT.notRequestStep(id)] : [])

const responseReference = (step, index) => (step.source === CONDITION_RESPONSE ? referenceProblem(index, step.step) : [])

const hasConditions = hasActiveCondition

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

function requestProblems(step, requests) {
  if (!step.request && !step.requestId) return [TEXT.noRequest]
  return resolveRequest(step, requests) ? [] : [TEXT.missingRequest(step.request || step.requestId)]
}

const runsBefore = (order, from, step) => order.indexOf(from) < order.indexOf(step)

const isSibling = (index, first, second) => isBranch(index, first) && index.get(first).parent === index.get(second)?.parent

function placeProblems(input, request) {
  if (input.target === INPUT_BODY && !bodyPath(input.name)) return [TEXT.inputBadPath(input.name)]
  if (!request) return []
  if (input.target === INPUT_BODY && !acceptsBody(request.bodyType)) return [TEXT.inputNotJson(input.name)]
  return input.target === INPUT_FORM && !acceptsForm(request.bodyType) ? [TEXT.inputNotForm(input.name)] : []
}

function inputProblems(step, index, request, order) {
  return step.inputs.flatMap((input) => {
    if (!INPUT_TARGETS.includes(input.target)) return [TEXT.unknownInput(input.target)]
    if (input.name === '') return [TEXT.noInputName]
    const own = valueProblems(index, input)
    if (own.length > 0) return own
    if (input.step && !runsBefore(order, input.step, step.id)) return [TEXT.notEarlierStep(input.step)]
    if (input.step && isSibling(index, input.step, step.id)) return [TEXT.siblingBranch(input.step)]
    return placeProblems(input, request)
  })
}

const KIND_PROBLEMS = {
  [STEP_REQUEST]: (step, { index, requests }) => [
    ...requestProblems(step, requests),
    ...inputProblems(step, index, resolveRequest(step, requests), [...index.keys()]),
  ],
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
  [STEP_PARALLEL]: (step) => (step.steps.length > 0 ? [] : [TEXT.emptyParallel]),
}

const hasRetry = (step) => step.kind === STEP_REQUEST && (step.retry.times > 1 || hasConditions(step.retry.until))

function branchProblems(step, scope) {
  if (!isBranch(scope.index, step.id)) return []
  if (!BRANCH_KINDS.includes(step.kind)) return [TEXT.branchKind]
  return [
    ...(targetsOf(step).length > 0 ? [TEXT.branchJump] : []),
    ...(hasRetry(step) ? [TEXT.branchRetry] : []),
  ]
}

function stepProblems(step, scope) {
  if (!STEP_KINDS.includes(step.kind)) return [TEXT.unknownKind(step.kind)]
  const own = KIND_PROBLEMS[step.kind]?.(step, scope) ?? []
  const branch = branchProblems(step, scope)
  return [...own, ...branch, ...(branch.length > 0 ? [] : targetProblems(scope.index, step))]
}

const hasPlaceholder = (template) => template.includes('{{')

const isInput = (declared) => declared.input === true

function loopProblems(flow) {
  const { looped } = declarationOrder(namedDeclared(flow), isInput)
  return looped.length > 0 ? [TEXT.variablesLoop(looped)] : []
}

function declaredProblems(flow) {
  const seen = new Set()
  const problems = flow.variables.flatMap((declared) => {
    if (declared.name === '') return [TEXT.noVariableName]
    if (seen.has(declared.name)) return [TEXT.variableTwice(declared.name)]
    seen.add(declared.name)
    if (declared.required || hasPlaceholder(declared.value) || coerce(declared.value, declared.type).ok) return []
    return [TEXT.notOfType(declared.name, TEXT.typeNames[declared.type], declared.value)]
  })
  return problems.length > 0 ? problems : loopProblems(flow)
}

const outputProblems = (flow, index) => flow.outputs.flatMap((output) => valueProblems(index, output))

const conditionListsOf = (step) => [step.conditions, step.until, ...(step.cases || []).map((entry) => entry.conditions)].filter(Array.isArray)

const tooDeep = (step) => conditionListsOf(step).some((conditions) => groupDepth(conditions) > MAX_GROUP_DEPTH)

const loopNamesOf = (step) => [step.as, step.indexAs].filter(Boolean)

function shapeProblems(step, declaredNames) {
  const hidden = loopNamesOf(step).filter((name) => declaredNames.has(name)).map((name) => TEXT.loopHidesVariable(name))
  return tooDeep(step) ? [...hidden, TEXT.groupsTooDeep(MAX_GROUP_DEPTH)] : hidden
}

function flowScope(flow, requests, flows) {
  const others = flows.filter((candidate) => candidate.id !== flow.id)
  const known = [flow, ...others]
  return { flow, requests, flows: known, flowsById: new Map(known.map((candidate) => [candidate.id, candidate])), index: indexSteps(flow.steps) }
}

export function validateFlow(flow, requests, flows = []) {
  if (flow.steps.length === 0) return [{ step: '', message: TEXT.noSteps }]
  const scope = flowScope(flow, requests, flows)
  const problems = [...declaredProblems(flow), ...outputProblems(flow, scope.index)].map((message) => ({ step: '', message }))
  const declaredNames = new Set(flow.variables.map((declared) => declared.name))
  walkSteps(flow.steps, (step) => {
    const messages = [...stepProblems(step, scope), ...shapeProblems(step, declaredNames)]
    messages.forEach((message) => problems.push({ step: step.id, message }))
  })
  return problems
}

export function describeProblems(flow, problems, requests, flows) {
  const index = indexSteps(flow.steps)
  const lines = problems.map(({ step, message }) => (step ? TEXT.problem(stepTitle(index.get(step).step, requests, flows), message) : message))
  return [TEXT.cannotRun(problems.length), ...lines].join('\n')
}
