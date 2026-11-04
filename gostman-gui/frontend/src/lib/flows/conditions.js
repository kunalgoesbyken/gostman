import { isPlainObject } from '../dataUtils'
import { isActiveAssertion, normalizeAssertions } from '../scripting/assertions'

export const MATCH_ALL = 'all'
export const MATCH_ANY = 'any'
export const MATCHES = [MATCH_ALL, MATCH_ANY]
export const MAX_GROUP_DEPTH = 4

export const isGroup = (item) => isPlainObject(item) && Array.isArray(item.conditions)

const matchOf = (value) => (MATCHES.includes(value) ? value : MATCH_ALL)

export function normalizeConditions(raw) {
  if (!Array.isArray(raw)) return normalizeAssertions(raw)
  return raw.filter(isPlainObject).flatMap((item) => {
    if (!isGroup(item)) return normalizeAssertions([item])
    const conditions = normalizeConditions(item.conditions)
    return conditions.length > 0 ? [{ match: matchOf(item.match), conditions }] : []
  })
}

export const groupDepth = (items) => items.reduce((deepest, item) => (isGroup(item) ? Math.max(deepest, 1 + groupDepth(item.conditions)) : deepest), 0)

export const conditionLeaves = (items) => items.flatMap((item) => (isGroup(item) ? conditionLeaves(item.conditions) : [item]))

export const activeLeaves = (items) => conditionLeaves(items).filter(isActiveAssertion)

export const hasActiveCondition = (items) => activeLeaves(items).length > 0

export const hasGroups = (items) => items.some(isGroup)

export const blankGroup = (match, conditions) => ({ match: match === MATCH_ALL ? MATCH_ANY : MATCH_ALL, conditions })
