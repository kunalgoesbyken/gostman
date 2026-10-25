import { evaluateJsonPath } from './chaining'
import { RESPONSE_TEXT } from './responseText'

export const MAX_MATCHES = 2000

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findMatches(text, query) {
  if (query === '' || text === '') return []
  const pattern = new RegExp(escapeRegExp(query), 'gi')
  const matches = []
  let match = pattern.exec(text)
  while (match && matches.length < MAX_MATCHES) {
    matches.push(match.index)
    match = pattern.exec(text)
  }
  return matches
}

export function stepIndex(current, count, direction) {
  if (count === 0) return 0
  return (current + direction + count) % count
}

export function filterJson(json, path) {
  const trimmed = path.trim()
  if (trimmed === '') return { active: false }
  const { value, error } = evaluateJsonPath(json, trimmed)
  if (error) return { active: true, error: RESPONSE_TEXT.invalidJsonPath(error) }
  if (value === undefined) return { active: true, error: RESPONSE_TEXT.noPathMatch }
  return { active: true, value, text: JSON.stringify(value, null, 2) }
}
