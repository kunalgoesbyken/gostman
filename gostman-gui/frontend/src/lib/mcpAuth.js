import { WEB_APP_URL } from './constants'
import { metadataUrlFor } from './mcpClientMetadata'
import { toMcpTarget } from './mcp'
import { withToken } from './oauth'

export const STEP_RUNNING = 'running'
const STEP_OK = 'ok'
export const STEP_FAILED = 'failed'
const STEP_RETRY = 'retry'

const settle = (steps, outcome, extra = {}) => [...steps.slice(0, -1), { ...steps.at(-1), outcome, ...extra }]

class StepFailure extends Error {}

function createTimeline(initial, onChange) {
  let steps = initial
  const publish = (next) => {
    steps = next
    onChange(steps)
  }
  const run = async (step, work, problem) => {
    publish([...steps, { step, outcome: STEP_RUNNING }])
    try {
      const { detail = '', value } = await work()
      publish(settle(steps, STEP_OK, { detail }))
      return value
    } catch (error) {
      const message = error?.message ?? String(error)
      publish(settle(steps, STEP_FAILED, { problem: error?.problem || problem, detail: message }))
      throw new StepFailure(message)
    }
  }
  return { run }
}

const rejection = (problem, message = '') => Object.assign(new Error(message), { problem })

function checkIssuer(received, plan) {
  const expected = plan.config.issuer
  if (received && expected && received !== expected) throw rejection('issuerWrong', `expected "${expected}", received "${received}"`)
  if (!received && plan.issuerRequired) throw rejection('issuerMissing')
  return { detail: received || '' }
}

export async function signInToMcp(backend, request, variables, onSteps) {
  const redirectUri = backend.oauthCallback.url
  const plan = await backend.discoverMcpAuthorization({
    target: toMcpTarget(request, variables),
    redirectUri,
    clientMetadataUrl: metadataUrlFor(WEB_APP_URL, redirectUri),
  })
  onSteps(plan.steps)
  if (!plan.ready) return null
  const timeline = createTimeline(plan.steps, onSteps)
  try {
    const grant = await timeline.run('browser', async () => ({ value: await backend.authorize({ ...plan.config, issuer: '' }, variables) }), 'browserFailed')
    await timeline.run('issuer', async () => checkIssuer(grant.issuer, plan))
    return await timeline.run('token', async () => {
      const token = await backend.fetchToken({ config: plan.config, variables, options: request.options, ...grant })
      return { detail: plan.config.scope, value: withToken(plan.config, token) }
    }, 'tokenFailed')
  } catch (error) {
    if (error instanceof StepFailure) return null
    throw error
  }
}

export const retryStep = (catalog) => (
  catalog.error
    ? { step: STEP_RETRY, outcome: STEP_FAILED, problem: 'stillRejected', detail: catalog.error }
    : { step: STEP_RETRY, outcome: STEP_OK, detail: '' }
)
