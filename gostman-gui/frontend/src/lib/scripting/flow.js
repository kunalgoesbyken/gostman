import { FLOW_SCRIPT_TEXT } from '../flowsText'

export const FLOW_NEXT = 'next'
export const FLOW_SKIP = 'skip'
export const FLOW_STOP = 'stop'
export const FLOW_END = 'end'

export const holdsBack = (flow) => flow.action === FLOW_SKIP || flow.action === FLOW_STOP

export const reasonFor = (flow) => (flow.action === FLOW_STOP ? FLOW_SCRIPT_TEXT.stopped : FLOW_SCRIPT_TEXT.skipped)

export function createFlow() {
  const state = { action: '', target: '' }
  const set = (action, target = '') => {
    state.action = action
    state.target = target
  }
  const api = {
    setNextRequest: (name) => (name === null || name === undefined ? set(FLOW_END) : set(FLOW_NEXT, String(name))),
    skipRequest: () => set(FLOW_SKIP),
    stopExecution: () => set(FLOW_STOP),
  }
  return { api, state }
}
