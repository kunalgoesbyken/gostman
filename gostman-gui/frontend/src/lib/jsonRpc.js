import { isPlainObject } from './dataUtils'

const VERSION = '2.0'
const FIRST_ID = 1

const isCall = (value) => isPlainObject(value) && value.jsonrpc === VERSION

const blankCall = (id) => ({ jsonrpc: VERSION, method: '', params: {}, id })

function existingCalls(body) {
  if (body.trim() === '') return []
  try {
    const parsed = JSON.parse(body)
    const calls = Array.isArray(parsed) ? parsed : [parsed]
    return calls.every(isCall) ? calls : null
  } catch {
    return null
  }
}

const nextId = (calls) => Math.max(FIRST_ID - 1, ...calls.map((call) => (Number.isInteger(call.id) ? call.id : 0))) + 1

export function addJsonRpcCall(body) {
  const calls = existingCalls(body)
  if (calls === null) return null
  const all = [...calls, blankCall(nextId(calls))]
  return JSON.stringify(all.length === 1 ? all[0] : all, null, 2)
}
