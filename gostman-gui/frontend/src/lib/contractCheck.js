import { CONTRACT_TEXT } from './checksText'
import { contractChecks, findOperation } from './contract'

const ACTION_CONTRACT = 'contract'
const NO_CHECKS = { tests: [], logs: [], error: '', note: '' }

export const checksContract = (link) => Boolean(link?.source) && link.contract !== false

export const linkFor = (specLinks, lineage) => (
  [...lineage].reverse().map(({ id }) => specLinks[id]).find(checksContract) ?? null
)

async function fetchContract(backend, source) {
  const reply = await backend.openapi({ action: ACTION_CONTRACT, source })
  if (reply.error) throw new Error(reply.error)
  return reply.contract
}

function linkedOperation(contract, link, requestId) {
  const key = Object.keys(link.ops || {}).find((candidate) => link.ops[candidate][0] === requestId)
  return key ? contract.operations.find((operation) => operation.key === key) : undefined
}

export function createContractChecker(backend) {
  const cache = new Map()

  const load = (link) => {
    const key = JSON.stringify([link.source, link.syncedAt])
    if (!cache.has(key)) {
      cache.set(key, fetchContract(backend, link.source).catch((error) => {
        cache.delete(key)
        throw error
      }))
    }
    return cache.get(key)
  }

  return async function checkContract(link, request, response) {
    if (!link || response.protocol) return NO_CHECKS
    let contract
    try {
      contract = await load(link)
    } catch (error) {
      return { ...NO_CHECKS, note: CONTRACT_TEXT.unreadable(error.message) }
    }
    const linked = linkedOperation(contract, link, request.id)
    const { operation, note } = linked ? { operation: linked, note: '' } : findOperation(contract, request.method, response.url)
    if (!operation) return { ...NO_CHECKS, note }
    return { ...NO_CHECKS, tests: contractChecks(operation, contract.root, response) }
  }
}
