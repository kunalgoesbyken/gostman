// Subsequence match: every character of the query appears in order. Higher scores
// are better; null means no match. Runs of characters and word starts score more.
const WORD_START = /[\s/\-_.:?&=]/

function wordScore(haystack, needle) {
  let score = 0
  let position = 0
  let streak = 0
  for (const character of needle) {
    const found = haystack.indexOf(character, position)
    if (found === -1) return null
    const atWordStart = found === 0 || WORD_START.test(haystack[found - 1])
    streak = found === position ? streak + 1 : 0
    score += 1 + streak * 2 + (atWordStart ? 4 : 0) - Math.min(found - position, 5) * 0.2
    position = found + 1
  }
  return haystack.includes(needle) ? score + 10 : score
}

// Each space-separated word of the query must match, in any order.
export function fuzzyScore(text, query) {
  const haystack = text.toLowerCase()
  let total = 0
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const score = wordScore(haystack, word)
    if (score === null) return null
    total += score
  }
  return total
}
