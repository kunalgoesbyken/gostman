const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_PAD = '='
const REPLACEMENT = 0xfffd
const SURROGATE_START = 0xd800
const SURROGATE_END = 0xdfff
const LOW_SURROGATE_START = 0xdc00
const ASTRAL_START = 0x10000

const isHighSurrogate = (unit) => unit >= SURROGATE_START && unit < LOW_SURROGATE_START
const isLowSurrogate = (unit) => unit >= LOW_SURROGATE_START && unit <= SURROGATE_END

function codePointsOf(text) {
  const points = []
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    const next = text.charCodeAt(index + 1)
    if (isHighSurrogate(unit) && isLowSurrogate(next)) {
      points.push(ASTRAL_START + ((unit - SURROGATE_START) << 10) + (next - LOW_SURROGATE_START))
      index += 1
    } else {
      points.push(unit >= SURROGATE_START && unit <= SURROGATE_END ? REPLACEMENT : unit)
    }
  }
  return points
}

function utf8Of(point) {
  if (point < 0x80) return [point]
  if (point < 0x800) return [0xc0 | (point >> 6), 0x80 | (point & 0x3f)]
  if (point < ASTRAL_START) return [0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f)]
  return [0xf0 | (point >> 18), 0x80 | ((point >> 12) & 0x3f), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f)]
}

export const utf8Encode = (text) => Uint8Array.from(codePointsOf(text).flatMap(utf8Of))

const sequenceLength = (lead) => {
  if (lead < 0x80) return 1
  if (lead >= 0xf0 && lead < 0xf8) return 4
  if (lead >= 0xe0) return 3
  return lead >= 0xc0 ? 2 : 0
}

const LEAD_MASKS = { 1: 0x7f, 2: 0x1f, 3: 0x0f, 4: 0x07 }

function codePointAt(bytes, start, length) {
  let point = bytes[start] & LEAD_MASKS[length]
  for (let offset = 1; offset < length; offset += 1) {
    const byte = bytes[start + offset]
    if ((byte & 0xc0) !== 0x80) return null
    point = (point << 6) | (byte & 0x3f)
  }
  return point
}

export function utf8Decode(bytes) {
  let text = ''
  let index = 0
  while (index < bytes.length) {
    const length = sequenceLength(bytes[index])
    const point = length === 0 || index + length > bytes.length ? null : codePointAt(bytes, index, length)
    text += String.fromCodePoint(point === null || point > 0x10ffff ? REPLACEMENT : point)
    index += point === null ? 1 : length
  }
  return text
}

export function bytesToBase64(bytes) {
  let text = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] || 0) << 8) | (bytes[index + 2] || 0)
    const remaining = bytes.length - index
    text += BASE64_ALPHABET[(chunk >> 18) & 63] + BASE64_ALPHABET[(chunk >> 12) & 63]
    text += remaining > 1 ? BASE64_ALPHABET[(chunk >> 6) & 63] : BASE64_PAD
    text += remaining > 2 ? BASE64_ALPHABET[chunk & 63] : BASE64_PAD
  }
  return text
}

const URL_SAFE = { '-': '+', _: '/' }

export function base64ToBytes(text) {
  const symbols = Array.from(text.trim(), (symbol) => URL_SAFE[symbol] || symbol).filter((symbol) => symbol !== BASE64_PAD)
  const bytes = []
  let bits = 0
  let held = 0
  for (const symbol of symbols) {
    const value = BASE64_ALPHABET.indexOf(symbol)
    if (value < 0) throw new Error('The text is not valid base64.')
    bits = (bits << 6) | value
    held += 6
    if (held >= 8) {
      held -= 8
      bytes.push((bits >> held) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

export const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export function hexToBytes(text) {
  const digits = text.trim()
  if (digits.length % 2 !== 0 || digits.split('').some((digit) => !'0123456789abcdefABCDEF'.includes(digit))) {
    throw new Error('The text is not valid hexadecimal.')
  }
  return Uint8Array.from({ length: digits.length / 2 }, (_, index) => parseInt(digits.slice(index * 2, index * 2 + 2), 16))
}
