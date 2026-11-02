import {
  CONTEXT_CHARS, MAX_HITS_PER_DOCUMENT, MAX_RESULTS, MAX_SCANNED_CHARS, SEARCH_BUDGET_MS,
} from './globalSearchLimits'
import { foldText, foldWithOffsets } from './searchFold'

function hitAt(field, offsets, at, length) {
  const start = offsets[at]
  const end = offsets[at + length - 1] + 1
  return {
    field: field.label,
    before: field.text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    hit: field.text.slice(start, end),
    after: field.text.slice(end, end + CONTEXT_CHARS),
  }
}

function hitsIn(field, needle, room) {
  const { folded, offsets } = foldWithOffsets(field.text.slice(0, MAX_SCANNED_CHARS))
  const hits = []
  let from = 0
  while (hits.length < room) {
    const at = folded.indexOf(needle, from)
    if (at < 0) break
    hits.push(hitAt(field, offsets, at, needle.length))
    from = at + needle.length
  }
  return hits
}

function documentHits(document, needle) {
  const hits = []
  for (const field of document.fields) {
    if (hits.length >= MAX_HITS_PER_DOCUMENT) break
    hits.push(...hitsIn(field, needle, MAX_HITS_PER_DOCUMENT - hits.length))
  }
  return hits
}

const summary = ({ key, kind, id, title, subtitle }, hits) => ({ key, kind, id, title, subtitle, hits })

export function searchDocuments(documents, query) {
  const needle = foldText(query.trim())
  if (needle === '') return { results: [], truncated: false }
  const deadline = Date.now() + SEARCH_BUDGET_MS
  const results = []
  for (const document of documents) {
    if (results.length >= MAX_RESULTS || Date.now() > deadline) return { results, truncated: true }
    const hits = documentHits(document, needle)
    if (hits.length > 0) results.push(summary(document, hits))
  }
  return { results, truncated: false }
}
