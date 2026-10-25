import { FLOW_ENGINE_TEXT as TEXT, FLOW_FIELD_TEXT, FLOW_KIND_TEXT } from '../flowsText'
import { isActiveAssertion } from '../scripting/assertions'
import {
  END_TARGET, STEP_FOR_EACH, STEP_IF, STEP_KINDS, STEP_REQUEST, STEP_SET, indexSteps, loopsAround, targetsOf, walkSteps,
} from './model'

const PATH_SEPARATOR = '/'

const lastSegment = (path) => path.slice(path.lastIndexOf(PATH_SEPARATOR) + 1)

const uniqueMatch = (requests, matches) => {
  const found = requests.filter(matches)
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

export const kindText = (kind) => FLOW_KIND_TEXT[kind] || FLOW_KIND_TEXT.unknown

export function stepTitle(step, requests = []) {
  if (step.label.trim() !== '') return step.label.trim()
  if (step.kind !== STEP_REQUEST) return kindText(step.kind).label
  const request = resolveRequest(step, requests)
  if (request) return request.name
  return step.request ? lastSegment(step.request) : kindText(step.kind).label
}

const isRequestStep = (index, id) => index.get(id)?.step.kind === STEP_REQUEST

function targetProblems(index, step) {
  const around = loopsAround(index, step.id)
  return targetsOf(step).flatMap(([field, target]) => {
    if (target === END_TARGET) return []
    if (!index.has(target)) return [TEXT.unknownTarget(FLOW_FIELD_TEXT[field], target)]
    const isReachable = loopsAround(index, target).every((loop) => around.includes(loop))
    return isReachable ? [] : [TEXT.intoLoop(FLOW_FIELD_TEXT[field], target)]
  })
}

const referenceProblem = (index, id) => (id && !isRequestStep(index, id) ? [TEXT.notRequestStep(id)] : [])

function valueProblems(index, value) {
  if (value.name === '') return [TEXT.noName]
  if (value.value !== undefined) return []
  if (!value.step) return [TEXT.noValueStep(value.name)]
  if (!isRequestStep(index, value.step)) return [TEXT.notRequestStep(value.step)]
  return value.source === 'body' && value.path === '' ? [TEXT.noSource(value.name)] : []
}

const KIND_PROBLEMS = {
  [STEP_REQUEST]: (step, index, requests) => {
    if (!step.request && !step.requestId) return [TEXT.noRequest]
    return resolveRequest(step, requests) ? [] : [TEXT.missingRequest(step.request || step.requestId)]
  },
  [STEP_SET]: (step, index) => step.values.flatMap((value) => valueProblems(index, value)),
  [STEP_IF]: (step, index) => [
    ...(step.conditions.some(isActiveAssertion) ? [] : [TEXT.noConditions]),
    ...(step.source === 'response' ? referenceProblem(index, step.step) : []),
  ],
  [STEP_FOR_EACH]: (step, index) => [
    ...(step.step ? referenceProblem(index, step.step) : [TEXT.noList]),
    ...(step.path ? [] : [TEXT.noPath]),
    ...(step.steps.length > 0 ? [] : [TEXT.emptyLoop]),
  ],
}

function stepProblems(step, index, requests) {
  if (!STEP_KINDS.includes(step.kind)) return [TEXT.unknownKind(step.kind)]
  const own = KIND_PROBLEMS[step.kind]?.(step, index, requests) ?? []
  return [...own, ...targetProblems(index, step)]
}

export function validateFlow(flow, requests) {
  if (flow.steps.length === 0) return [{ step: '', message: TEXT.noSteps }]
  const index = indexSteps(flow.steps)
  const problems = []
  walkSteps(flow.steps, (step) => {
    stepProblems(step, index, requests).forEach((message) => problems.push({ step: step.id, message }))
  })
  return problems
}

export function describeProblems(flow, problems, requests) {
  const index = indexSteps(flow.steps)
  const lines = problems.map(({ step, message }) => (step ? TEXT.problem(stepTitle(index.get(step).step, requests), message) : message))
  return [TEXT.cannotRun(problems.length), ...lines].join('\n')
}
