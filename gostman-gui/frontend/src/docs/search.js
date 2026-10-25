const WEIGHTS = { heading: 5, page: 2, text: 1 }
const FIELDS = Object.keys(WEIGHTS)
const HEADING_START_BONUS = 5
const SNIPPET_BEFORE = 60
const SNIPPET_LENGTH = 180
const RESULT_LIMIT = 20

export const termsOf = (query) => query.toLowerCase().split(/\s+/).filter(Boolean)

export const prepareIndex = (records) =>
  records.map(([title, section, href, text]) => ({
    title,
    section,
    href,
    text,
    lower: {
      heading: (section || title).toLowerCase(),
      page: section ? title.toLowerCase() : "",
      text: text.toLowerCase(),
    },
  }))

const termScore = (entry, term) =>
  Math.max(0, ...FIELDS.filter((field) => entry.lower[field].includes(term)).map((field) => WEIGHTS[field]))

function score(entry, terms, phrase) {
  const scores = terms.map((term) => termScore(entry, term))
  if (scores.includes(0)) return 0
  const startBonus = entry.lower.heading.startsWith(phrase) ? HEADING_START_BONUS : 0
  return scores.reduce((sum, value) => sum + value, 0) + startBonus
}

const hitsOf = (entry, terms) => terms.reduce((sum, term) => sum + entry.lower.text.split(term).length - 1, 0)

export function searchIndex(index, query) {
  const terms = termsOf(query)
  if (!terms.length) return []
  const phrase = query.trim().toLowerCase()
  return index
    .map((entry) => ({ entry, score: score(entry, terms, phrase) }))
    .filter((match) => match.score > 0)
    .map((match) => ({ ...match, hits: hitsOf(match.entry, terms) }))
    .sort((a, b) => b.score - a.score || b.hits - a.hits)
    .slice(0, RESULT_LIMIT)
    .map((match) => match.entry)
}

export function snippet(text, terms) {
  const lower = text.toLowerCase()
  const hits = terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0)
  const first = hits.length ? Math.min(...hits) : 0
  const start = Math.max(0, first - SNIPPET_BEFORE)
  const from = start ? text.indexOf(" ", start) + 1 : 0
  const cut = text.slice(from, from + SNIPPET_LENGTH)
  return `${from ? "…" : ""}${cut}${from + SNIPPET_LENGTH < text.length ? "…" : ""}`
}

function nextHit(lower, terms, from) {
  return terms
    .map((term) => ({ at: lower.indexOf(term, from), length: term.length }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at || b.length - a.length)[0]
}

export function highlight(text, terms) {
  const lower = text.toLowerCase()
  const parts = []
  let cursor = 0
  for (let hit = nextHit(lower, terms, 0); hit; hit = nextHit(lower, terms, cursor)) {
    if (hit.at > cursor) parts.push({ text: text.slice(cursor, hit.at), match: false })
    parts.push({ text: text.slice(hit.at, hit.at + hit.length), match: true })
    cursor = hit.at + hit.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}
