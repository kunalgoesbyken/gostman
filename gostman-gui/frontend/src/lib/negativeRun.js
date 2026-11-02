import { AUTH_INHERIT, inheritedAuthSource, lineageOf } from './inheritance'
import { negativeFindings, negativeVariants } from './negative'
import { requestsInScope } from './runner'
import { collectionHostsBy } from './scripting/destinations'
import { isSocketAddress } from './socketSessions'
import { variableTextFor } from '../store/appStore'

export const DEFAULT_RATE = 5
export const DEFAULT_LIMIT = 300
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const NO_TAG_FILTER = { include: [], exclude: [] }
const SEND_ID_PREFIX = 'negative'
const MILLISECONDS = 1000

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const isTestable = (state, request) => HTTP_METHODS.includes(request.method) && !isSocketAddress(request.url, variableTextFor(state, request))

export function planNegative(state, folderId) {
  const scoped = requestsInScope(state, folderId, NO_TAG_FILTER).filter((request) => isTestable(state, request))
  return scoped.map((request) => {
    const inherited = inheritedAuthSource({ type: AUTH_INHERIT }, lineageOf(state, request.folderId)) !== null
    return { request, variants: negativeVariants(request, inherited) }
  })
}

export const hostsOfPlan = (state, plan) => (
  collectionHostsBy(plan.map(({ request }) => request), (request) => variableTextFor(state, request))
)

export const variantCount = (plan) => plan.reduce((total, { variants }) => total + variants.length, 0)

export function createNegativeRunner(execute) {
  let sequence = 0

  return async function runNegative(plan, { rate, limit, isStopped, onSent, onFinding }) {
    let sent = 0
    for (const { request, variants } of plan) {
      for (const variant of variants) {
        if (isStopped() || sent >= limit) return
        sequence += 1
        const { response } = await execute(variant.request, `${SEND_ID_PREFIX}-${sequence}`)
        sent += 1
        onSent(sent)
        if (!response.error) negativeFindings(variant, response).forEach((found) => onFinding({ ...found, requestId: request.id, requestName: request.name, method: request.method }))
        await pause(MILLISECONDS / rate)
      }
    }
  }
}
