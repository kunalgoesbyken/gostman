import { callsOf } from './callHistory'

export const HISTORY_IDENTITY_FIELDS = ['method', 'url', 'body', 'bodyType', 'graphqlQuery', 'graphqlVariables', 'grpcMethod', 'grpcMessage', 'mcpMethod', 'mcpTool', 'mcpArguments']

export const historyIdentityOf = (entry) => JSON.stringify(HISTORY_IDENTITY_FIELDS.map((field) => entry[field]))

function callIndexOf(entry, stale) {
  const at = callsOf(stale.entry)[stale.callIndex]?.at
  const calls = callsOf(entry)
  if (at === undefined) return -1
  return calls[stale.callIndex]?.at === at ? stale.callIndex : calls.findIndex((call) => call.at === at)
}

export function currentTargetOf(entries, target) {
  if (entries.includes(target.entry)) return target
  const identity = historyIdentityOf(target.entry)
  const entry = entries.find((candidate) => historyIdentityOf(candidate) === identity)
  if (!entry) return null
  if (target.callIndex === null) return { ...target, id: entry.id, entry }
  const callIndex = callIndexOf(entry, target)
  return callIndex < 0 ? null : { ...target, entry, callIndex }
}
