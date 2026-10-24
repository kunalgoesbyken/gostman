import { FLOW_NEXT, FLOW_STOP } from './scripting/flow'
import { MAX_FLOW_STEPS } from './scripting/limits'

const TOO_MANY_JUMPS = `The script redirected the run more than ${MAX_FLOW_STEPS} times, so the run was stopped.`
const NOT_PARALLEL = (target) => `The script asked to continue with "${target}", but requests run in parallel so the order cannot be changed.`
const UNKNOWN = (target) => `The script asked to continue with "${target}", but no request in this run has that name.`

const passedByJump = (name, target) => `Not run because a script in "${name}" continued the run with "${target}".`
const passedByStop = (name) => `Not run because a script in "${name}" stopped the run.`

const matches = (target) => (request) => request.name === target || request.id === target

export function createFlowFollower(run, requests, queue, isParallel) {
  let jumps = 0
  const passedOver = new Map()
  const pass = (dropped, reason) => dropped.forEach((request) => passedOver.has(request) || passedOver.set(request, reason))
  const halt = (problem) => {
    run.isHalted = true
    return problem
  }
  const follow = (flow, name) => {
    if (flow.action === FLOW_STOP) {
      pass(queue, passedByStop(name))
      return halt('')
    }
    if (flow.action !== FLOW_NEXT) return ''
    jumps += 1
    if (jumps > MAX_FLOW_STEPS) return halt(TOO_MANY_JUMPS)
    if (isParallel) return halt(NOT_PARALLEL(flow.target))
    const position = requests.findIndex(matches(flow.target))
    if (position < 0) return halt(UNKNOWN(flow.target))
    const next = requests.slice(position)
    pass(queue.filter((request) => !next.includes(request)), passedByJump(name, flow.target))
    queue.splice(0, queue.length, ...next)
    return ''
  }
  return { follow, passedOver }
}
