export const PSEUDO_ACCENTED = 'en-XA'
export const PSEUDO_RTL = 'ar-XB'
export const PSEUDO_LOCALES = [PSEUDO_ACCENTED, PSEUDO_RTL]

const ACCENTS = {
  a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', c: 'ç', n: 'ñ', y: 'ý', s: 'š', z: 'ž',
  A: 'Á', E: 'É', I: 'Í', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ',
}
const VOWELS = 'áéíöüÁÉÍÖÜ'
const GROWTH = 1.35
const PLACEHOLDER = /(\{\{[A-Za-z][A-Za-z0-9]*\}\})/
const RIGHT_TO_LEFT_OVERRIDE = '‮'
const POP_DIRECTIONAL_FORMATTING = '‬'
const PADDING = '~'
const BRACKET_LENGTH = 2

const isObject = (value) => value !== null && typeof value === 'object'

const accented = (segment) => [...segment].map((character) => ACCENTS[character] ?? character).join('')

const isPlaceholder = (segment) => PLACEHOLDER.test(segment)

const segmentsOf = (text) => text.split(PLACEHOLDER).filter((segment) => segment !== '')

function vowelPositions(segments) {
  return segments.flatMap((segment, index) => (isPlaceholder(segment) ? [] : [...segment].flatMap((character, position) => (VOWELS.includes(character) ? [{ index, position }] : []))))
}

function repeated(segments, positions, extra) {
  const copies = new Map(positions.map((place, order) => [`${place.index}:${place.position}`, Math.floor(extra / positions.length) + (order < extra % positions.length ? 1 : 0)]))
  return segments.map((segment, index) => (isPlaceholder(segment) ? segment : [...segment].map((character, position) => character.repeat(1 + (copies.get(`${index}:${position}`) ?? 0))).join('')))
}

function grown(segments, target) {
  const extra = target - segments.join('').length - BRACKET_LENGTH
  if (extra <= 0) return segments
  const positions = vowelPositions(segments)
  return positions.length === 0 ? [...segments, PADDING.repeat(extra)] : repeated(segments, positions, extra)
}

export function accentedMessage(text) {
  const segments = segmentsOf(text).map((segment) => (isPlaceholder(segment) ? segment : accented(segment)))
  return grown(segments, Math.ceil(text.length * GROWTH)).join('')
}

const bracketed = (text) => `[${text}]`

const reversedSegments = (text) =>
  segmentsOf(text).map((segment) => (isPlaceholder(segment) ? segment : `${RIGHT_TO_LEFT_OVERRIDE}${segment}${POP_DIRECTIONAL_FORMATTING}`)).join('')

const TRANSFORMS = {
  [PSEUDO_ACCENTED]: (text) => bracketed(accentedMessage(text)),
  [PSEUDO_RTL]: (text) => reversedSegments(bracketed(accentedMessage(text))),
}

export function pseudoTree(tree, language) {
  const transform = TRANSFORMS[language]
  return Object.fromEntries(Object.entries(tree).map(([key, value]) => [key, isObject(value) ? pseudoTree(value, language) : transform(value)]))
}

export const pseudoCatalogue = (english, language) => Object.fromEntries(Object.entries(english).map(([namespace, tree]) => [namespace, pseudoTree(tree, language)]))
