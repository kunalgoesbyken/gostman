const MAX_REQUESTS = 50
const MAX_CHARACTERS = 20 * 1024 * 1024

const kept = new Map()
let characters = 0

const weigh = ({ response }) => (response.body || '').length

function evictOldest() {
  const [oldest] = kept.keys()
  characters -= weigh(kept.get(oldest))
  kept.delete(oldest)
}

export function keepLastResponse(requestId, entry) {
  if (!requestId || !entry) return
  const previous = kept.get(requestId)
  if (previous) {
    characters -= weigh(previous)
    kept.delete(requestId)
  }
  if (weigh(entry) > MAX_CHARACTERS) return
  kept.set(requestId, entry)
  characters += weigh(entry)
  while (kept.size > MAX_REQUESTS || characters > MAX_CHARACTERS) evictOldest()
}

export const lastResponseOf = (requestId) => kept.get(requestId) ?? null

export function forgetLastResponses() {
  kept.clear()
  characters = 0
}
