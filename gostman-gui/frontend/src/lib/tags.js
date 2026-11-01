const TAG_SEPARATOR = ','

export const foldCase = (text) => text.toUpperCase().toLowerCase()

export function normalizeTags(raw) {
  const seen = new Set()
  const tags = []
  for (const value of Array.isArray(raw) ? raw : []) {
    const tag = typeof value === 'string' ? value.trim() : ''
    const key = foldCase(tag)
    if (tag === '' || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export function moveTag(tags, tag, offset) {
  const from = tags.indexOf(tag)
  const to = from + offset
  if (from < 0 || to < 0 || to >= tags.length) return tags
  const moved = [...tags]
  moved.splice(from, 1)
  moved.splice(to, 0, tag)
  return moved
}

export const splitTags = (text) => normalizeTags(text.split(TAG_SEPARATOR))

export const sameTags = (first, second) => {
  const left = normalizeTags(first)
  const right = normalizeTags(second)
  return left.length === right.length && left.every((tag, index) => tag === right[index])
}

const sharesTag = (tags, wanted) => {
  const held = new Set(normalizeTags(tags).map(foldCase))
  return wanted.some((tag) => held.has(foldCase(tag)))
}

export const matchesTags = (tags, { include = [], exclude = [] }) => (
  (include.length === 0 || sharesTag(tags, include)) && !sharesTag(tags, exclude)
)

export const collectTags = (requests) => normalizeTags(requests.flatMap((request) => normalizeTags(request.tags)))
