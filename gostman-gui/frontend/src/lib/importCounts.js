import { pluralize } from './dataUtils.js'

const OPTIONAL_COUNTS = [
  ['environments', 'environment'],
  ['variables', 'variable'],
  ['folderSettings', 'folder setting'],
]

export function describeCounts(counts) {
  const parts = [
    pluralize(counts.requests, 'request'),
    pluralize(counts.folders, 'folder'),
    ...OPTIONAL_COUNTS.filter(([key]) => counts[key] > 0).map(([key, noun]) => pluralize(counts[key], noun)),
  ]
  const last = parts.pop()
  return parts.length === 0 ? last : `${parts.join(', ')} and ${last}`
}
