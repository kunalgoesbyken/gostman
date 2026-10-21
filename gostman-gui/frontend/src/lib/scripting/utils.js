import { createDates } from './dates'
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, utf8Decode, utf8Encode } from './encoding'
import { HASH_ALGORITHMS, digest, hmac } from './hash'

const DEFAULT_ENCODING = 'hex'
const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DEFAULT_LENGTH = 16

const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value) ?? String(value))

const OUTPUTS = {
  hex: bytesToHex,
  base64: bytesToBase64,
}

function encoded(bytes, encoding) {
  const output = OUTPUTS[encoding]
  if (!output) throw new Error(`Unknown encoding "${encoding}". Use ${Object.keys(OUTPUTS).join(', ')}.`)
  return output(bytes)
}

const integerBetween = (low, high) => low + Math.floor(Math.random() * (high - low + 1))

const createRandom = () => ({
  int: (low = 0, high = 100) => integerBetween(Math.ceil(low), Math.floor(high)),
  string: (length = DEFAULT_LENGTH, alphabet = DEFAULT_ALPHABET) => (
    Array.from({ length }, () => alphabet[integerBetween(0, alphabet.length - 1)]).join('')
  ),
  pick: (items) => items[integerBetween(0, items.length - 1)],
})

export function createUtils() {
  const uuid = () => crypto.randomUUID()
  const hashers = Object.fromEntries(HASH_ALGORITHMS.map((name) => [
    name,
    (text, encoding = DEFAULT_ENCODING) => encoded(digest(name, utf8Encode(asText(text))), encoding),
  ]))
  return {
    uuid,
    guid: uuid,
    ...hashers,
    hmac: (algorithm, key, text, encoding = DEFAULT_ENCODING) => (
      encoded(hmac(algorithm, utf8Encode(asText(key)), utf8Encode(asText(text))), encoding)
    ),
    base64: {
      encode: (text) => bytesToBase64(utf8Encode(asText(text))),
      decode: (text) => utf8Decode(base64ToBytes(String(text))),
    },
    hex: {
      encode: (text) => bytesToHex(utf8Encode(asText(text))),
      decode: (text) => utf8Decode(hexToBytes(String(text))),
    },
    url: {
      encode: (text) => encodeURIComponent(asText(text)),
      decode: (text) => decodeURIComponent(String(text)),
    },
    date: createDates(),
    random: createRandom(),
  }
}
