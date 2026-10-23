const TAG_SEPARATOR = ','

const foldTag = (tag) => tag.toUpperCase().toLowerCase()

export function normalizeTags(raw) {
  const seen = new Set()
  const tags = []
  for (const value of Array.isArray(raw) ? raw : []) {
    const tag = typeof value === 'string' ? value.trim() : ''
    const key = foldTag(tag)
    if (tag === '' || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export const splitTags = (text) => normalizeTags(text.split(TAG_SEPARATOR))

export const sameTags = (first, second) => {
  const left = normalizeTags(first)
  const right = normalizeTags(second)
  return left.length === right.length && left.every((tag, index) => tag === right[index])
}

const sharesTag = (tags, wanted) => {
  const held = new Set(normalizeTags(tags).map(foldTag))
  return wanted.some((tag) => held.has(foldTag(tag)))
}

export const matchesTags = (tags, { include = [], exclude = [] }) => (
  (include.length === 0 || sharesTag(tags, include)) && !sharesTag(tags, exclude)
)

export const collectTags = (requests) => normalizeTags(requests.flatMap((request) => normalizeTags(request.tags)))
