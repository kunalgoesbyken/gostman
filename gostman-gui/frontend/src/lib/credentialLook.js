import TOKEN_FORMATS from '../../../../scan/token_formats.json'
import PLACEHOLDER_WORDS from '../../../../scan/placeholder_words.json'
import { isSensitiveName } from './sensitiveNames'

const MIN_RANDOM_LENGTH = 16
const MAX_RANDOM_LENGTH = 512
const MIN_ENTROPY = 3.5
const MAX_CHECKED_LENGTH = 10000
const MIN_REPEAT_LENGTH = 8
const MAX_REPEAT_SYMBOLS = 3
const MIN_BEARER_LENGTH = 20
const BEARER = 'bearer'
const PRIVATE_KEY_OPENING = '-----BEGIN '
const PRIVATE_KEY_CLOSING = 'PRIVATE KEY-----'
const REFERENCE_OPENING = '{{'
const URL_MARKER = '://'
const SEPARATORS = /[\s;,]+/u
const WRAPPERS = { '<': '>', '[': ']', '(': ')' }

const CHARSETS = {
  upper: (char) => char >= 'A' && char <= 'Z',
  lower: (char) => char >= 'a' && char <= 'z',
  digit: (char) => char >= '0' && char <= '9',
  dash: (char) => char === '-',
  underscore: (char) => char === '_',
  dot: (char) => char === '.',
}

const piecesOf = (value) => value.split(SEPARATORS).filter(Boolean).map((piece) => {
  const at = piece.indexOf('=')
  return at < 0 || piece.slice(at + 1).replaceAll('=', '') === '' ? piece : piece.slice(at + 1)
})

function entropyOf(value) {
  const counts = new Map()
  const chars = Array.from(value)
  chars.forEach((char) => counts.set(char, (counts.get(char) ?? 0) + 1))
  return Array.from(counts.values()).reduce((bits, count) => bits - (count / chars.length) * Math.log2(count / chars.length), 0)
}

function looksRandom(piece) {
  const length = Array.from(piece).length
  if (length < MIN_RANDOM_LENGTH || length > MAX_RANDOM_LENGTH || piece.includes(URL_MARKER)) return false
  if (!/\p{L}/u.test(piece) || !/\p{Nd}/u.test(piece)) return false
  return entropyOf(piece) >= MIN_ENTROPY
}

function isPlaceholder(piece) {
  const chars = Array.from(piece)
  const isWrapped = WRAPPERS[chars[0]] === chars.at(-1)
  const isRepetition = chars.length >= MIN_REPEAT_LENGTH && new Set(chars).size <= MAX_REPEAT_SYMBOLS
  const lowered = piece.toLowerCase()
  return isWrapped || isRepetition || PLACEHOLDER_WORDS.some((word) => lowered.includes(word))
}

const hasSegments = (token, count) => {
  if (!count) return true
  const parts = token.split('.')
  return parts.length === count && parts.every(Boolean)
}

function matchesFormat(token, format) {
  const prefix = format.prefixes.find((candidate) => token.startsWith(candidate))
  if (prefix === undefined) return false
  const body = token.slice(prefix.length)
  const allowed = format.charset.map((name) => CHARSETS[name])
  return body.length >= format.minBody
    && body.length <= format.maxBody
    && Array.from(body).every((char) => allowed.some((has) => has(char)))
    && hasSegments(token, format.segments)
}

const isKnownToken = (piece) => TOKEN_FORMATS.some((format) => matchesFormat(piece, format))

const isBearerValue = (pieces, index) => (
  index > 0
  && pieces[index - 1].toLowerCase() === BEARER
  && pieces[index].length >= MIN_BEARER_LENGTH
  && looksRandom(pieces[index])
)

const hasPrivateKey = (value) => value.includes(PRIVATE_KEY_OPENING) && value.includes(PRIVATE_KEY_CLOSING)

export function looksLikeCredential(name, value) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_CHECKED_LENGTH || value.includes(REFERENCE_OPENING)) return false
  const pieces = piecesOf(value)
  if (hasPrivateKey(value) || pieces.some(isKnownToken) || pieces.some((_, index) => isBearerValue(pieces, index))) return true
  return isSensitiveName(name) && pieces.some((piece) => !isPlaceholder(piece) && looksRandom(piece))
}
