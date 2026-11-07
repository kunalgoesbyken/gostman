const WORD_START = /[\s/\-_.:?&=]/

export function wordScore(haystack, needle) {
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

export const searchWords = (query) => query.toLowerCase().split(/\s+/).filter(Boolean)

export function wordsScore(haystack, words) {
  let total = 0
  for (const word of words) {
    const score = wordScore(haystack, word)
    if (score === null) return null
    total += score
  }
  return total
}

export const fuzzyScore = (text, query) => wordsScore(text.toLowerCase(), searchWords(query))
