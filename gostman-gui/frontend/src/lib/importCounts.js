import { pluralize } from './dataUtils.js'

const COUNTED = [
  ['requests', 'request'],
  ['folders', 'folder'],
  ['environments', 'environment'],
  ['globals', 'global environment'],
  ['variables', 'collection variable'],
  ['folderSettings', 'folder setting'],
]

export function describeCounts(counts) {
  const parts = COUNTED.filter(([key]) => counts[key] > 0).map(([key, noun]) => pluralize(counts[key], noun))
  if (parts.length === 0) return pluralize(0, 'request')
  const last = parts.pop()
  return parts.length === 0 ? last : `${parts.join(', ')} and ${last}`
}
