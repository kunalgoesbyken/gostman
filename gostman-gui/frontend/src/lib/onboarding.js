import { isPlainObject, parseJSON } from './dataUtils'
import { parseAssertions } from './scripting/assertions'
import { readStoredJSON, writeStored } from './storage'

const STORAGE_KEY = 'gostman.onboarding'

export const STEP_SEND = 'send'
export const STEP_SAVE = 'save'
export const STEP_VARIABLE = 'variable'
export const STEP_CHECK = 'check'
export const STEP_RUN = 'run'

const RETIRED_SAMPLE_REQUEST_ID = '1'

const definesVariables = (text) => {
  const variables = parseJSON(text, {})
  return isPlainObject(variables) && Object.keys(variables).length > 0
}

const isOwnRequest = (request) => request.id !== RETIRED_SAMPLE_REQUEST_ID

const hasCheck = (request) => parseAssertions(request.assertions).length > 0 || request.postScript.trim() !== ''

const COMPLETION = {
  [STEP_SEND]: (state) => state.requestHistory.length > 0,
  [STEP_SAVE]: (state) => state.requests.some(isOwnRequest),
  [STEP_VARIABLE]: (state) => (
    definesVariables(state.collectionVariables)
    || [...state.environments, ...state.globalEnvironments].some((environment) => definesVariables(environment.variables))
  ),
  [STEP_CHECK]: (state) => state.requests.some(hasCheck),
  [STEP_RUN]: (state) => state.onboardingSteps.includes(STEP_RUN),
}

export const STEP_IDS = Object.keys(COMPLETION)

export function onboardingProgress(state) {
  const steps = STEP_IDS.map((id) => ({ id, isDone: COMPLETION[id](state) }))
  const doneCount = steps.filter((step) => step.isDone).length
  return {
    steps,
    doneCount,
    nextId: steps.find((step) => !step.isDone)?.id || '',
    isComplete: doneCount === steps.length,
  }
}

export function rememberedSteps() {
  const stored = readStoredJSON(STORAGE_KEY, [])
  return Array.isArray(stored) ? stored.filter((id) => STEP_IDS.includes(id)) : []
}

export const rememberSteps = (steps) => writeStored(STORAGE_KEY, JSON.stringify(steps))
