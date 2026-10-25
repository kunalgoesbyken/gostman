import { FLOW_END, FLOW_NEXT, FLOW_STOP } from './scripting/flow'
import { MAX_FLOW_STEPS } from './scripting/limits'

const ENDLESS_JUMPS = (name, target, sent, planned) => (
  `The script in "${name}" kept continuing the run with "${target}", so the run was stopped after ${sent} requests. A pass may send at most ${MAX_FLOW_STEPS} more requests than the ${planned} it holds; give the loop a way to end, such as a retry count.`
)
const NOT_PARALLEL = (target) => `The script asked to continue with "${target}", but requests run in parallel so the order cannot be changed.`
const UNKNOWN = (target) => `The script asked to continue with "${target}", but no request in this run has that name.`

const passedByJump = (name, target) => `Not run because a script in "${name}" continued the run with "${target}".`
const passedByStop = (name) => `Not run because a script in "${name}" stopped the run.`
const passedByEnd = (name, iteration) => (iteration > 0 ? `Not run because a script in "${name}" ended iteration ${iteration}.` : passedByStop(name))

const matches = (target) => (request) => request.name === target || request.id === target

export function createFlowFollower(run, requests, queue, { isParallel, iteration }) {
  let sent = 0
  const passedOver = new Map()
  const pass = (dropped, reason) => dropped.forEach((request) => passedOver.has(request) || passedOver.set(request, reason))
  const halt = (problem) => {
    run.isHalted = true
    return problem
  }
  const repeat = (target, request) => {
    if (!matches(target)(request)) return halt(NOT_PARALLEL(target))
    queue.unshift(request)
    return ''
  }
  const follow = (flow, request) => {
    const { name } = request
    sent += 1
    if (flow.action === FLOW_STOP) {
      pass(queue, passedByStop(name))
      return halt('')
    }
    if (flow.action === FLOW_END) {
      pass(queue, passedByEnd(name, iteration))
      queue.length = 0
      return ''
    }
    if (flow.action !== FLOW_NEXT) return ''
    if (sent >= requests.length + MAX_FLOW_STEPS) return halt(ENDLESS_JUMPS(name, flow.target, sent, requests.length))
    if (isParallel) return repeat(flow.target, request)
    const position = requests.findIndex(matches(flow.target))
    if (position < 0) return halt(UNKNOWN(flow.target))
    const next = requests.slice(position)
    pass(queue.filter((request) => !next.includes(request)), passedByJump(name, flow.target))
    queue.splice(0, queue.length, ...next)
    return ''
  }
  return { follow, passedOver }
}
