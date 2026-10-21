import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes, utf8Decode, utf8Encode } from '../encoding'
import { digest, hmac } from '../hash'

const asBytes = (input) => (typeof input === 'string' ? utf8Encode(input) : input.bytes)

const ENCODERS = {
  Hex: { stringify: (words) => bytesToHex(words.bytes), parse: (text) => wordArray(hexToBytes(text)) },
  Base64: { stringify: (words) => bytesToBase64(words.bytes), parse: (text) => wordArray(base64ToBytes(text)) },
  Utf8: { stringify: (words) => utf8Decode(words.bytes), parse: (text) => wordArray(utf8Encode(text)) },
}

function wordArray(bytes) {
  return {
    bytes,
    sigBytes: bytes.length,
    toString: (encoder = ENCODERS.Hex) => encoder.stringify({ bytes }),
  }
}

const hasher = (algorithm) => (message) => wordArray(digest(algorithm, asBytes(message)))

const hmacHasher = (algorithm) => (message, key) => wordArray(hmac(algorithm, asBytes(key), asBytes(message)))

export function createCryptoJs() {
  return {
    MD5: hasher('md5'),
    SHA1: hasher('sha1'),
    SHA256: hasher('sha256'),
    SHA512: hasher('sha512'),
    HmacMD5: hmacHasher('md5'),
    HmacSHA1: hmacHasher('sha1'),
    HmacSHA256: hmacHasher('sha256'),
    HmacSHA512: hmacHasher('sha512'),
    enc: ENCODERS,
  }
}
