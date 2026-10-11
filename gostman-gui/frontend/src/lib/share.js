import { base64ToBytes, bytesToBase64 } from './base64'

export const MAX_LINK_FRAGMENT_LENGTH = 32 * 1024
const MAX_SHARED_BYTES = 10 * 1024 * 1024
export const MIN_PASSPHRASE_LENGTH = 8
export const SHARE_FILE_EXTENSION = 'gostman-share'
const CREDENTIAL_KEY = 'key'
export const CREDENTIAL_PASSPHRASE = 'passphrase'

const VERSION_KEY = '1'
const VERSION_PASSPHRASE = '1p'
const VERSIONS = [VERSION_KEY, VERSION_PASSPHRASE]
const FRAGMENT_NAME = 'share='
const LINK_MARKER = `#${FRAGMENT_NAME}`
const FILE_MARKER = 'gostman-share:'
const PART_SEPARATOR = '.'
const PART_COUNT = 3

const CIPHER = 'AES-GCM'
const KEY_BITS = 256
const KEY_BYTES = KEY_BITS / 8
const KEY_TEXT_LENGTH = Math.ceil((KEY_BYTES * 4) / 3)
const IV_BYTES = 12
const TAG_BYTES = 16
const SALT_BYTES = 16
const DERIVATION = 'PBKDF2'
const DERIVATION_HASH = 'SHA-256'
const DERIVATION_ROUNDS = 600_000
const KEY_USES = ['encrypt', 'decrypt']

const PACKED_PLAIN = 0
const PACKED_GZIP = 1
const GZIP = 'gzip'
const BASE64URL = /^[A-Za-z0-9_-]*$/
const WHITESPACE = /\s+/g

const UNAVAILABLE = 'Sharing needs the Web Crypto API, which is not available in this window.'
const INCOMPLETE = 'This share is incomplete. Copy the whole link, or choose the whole file, and try again.'
const CANNOT_DECOMPRESS = 'This share is compressed and this browser cannot decompress it. Open it in a current browser or in the desktop app.'
const TOO_LARGE = 'This share unpacks to more than Gostman imports at once, so it was not opened.'
const UNREADABLE = 'This share was decrypted but its contents are not readable text.'
const FAILURES = {
  '': 'This share could not be decrypted. The link was changed or cut short on the way.',
  [CREDENTIAL_KEY]: 'This share could not be decrypted. The key is wrong, or the file was changed.',
  [CREDENTIAL_PASSPHRASE]: 'This share could not be decrypted. The passphrase is wrong, or the share was changed.',
}

export class ShareError extends Error {}

const unknownVersion = (version) => new ShareError(
  `This share uses format "${version}", which this version of Gostman cannot open. Update Gostman and try again.`
)

const encoder = new TextEncoder()

function subtle() {
  const api = globalThis.crypto?.subtle
  if (!api) throw new ShareError(UNAVAILABLE)
  return api
}

const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

function joinBytes(...parts) {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

const toBase64Url = (bytes) => bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

function fromBase64Url(text) {
  if (!BASE64URL.test(text) || text.length % 4 === 1) throw new ShareError(INCOMPLETE)
  return base64ToBytes(text.replaceAll('-', '+').replaceAll('_', '/'))
}

const canCompress = () => typeof CompressionStream === 'function'

const canDecompress = () => typeof DecompressionStream === 'function'

async function readWithin(stream, limit) {
  const reader = stream.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return joinBytes(...chunks)
    total += value.length
    if (total > limit) {
      await reader.cancel()
      throw new ShareError(TOO_LARGE)
    }
    chunks.push(value)
  }
}

const transformed = (bytes, transform) => new Blob([bytes]).stream().pipeThrough(transform)

const compress = (bytes) => readWithin(transformed(bytes, new CompressionStream(GZIP)), MAX_SHARED_BYTES)

async function decompress(bytes) {
  if (!canDecompress()) throw new ShareError(CANNOT_DECOMPRESS)
  try {
    return await readWithin(transformed(bytes, new DecompressionStream(GZIP)), MAX_SHARED_BYTES)
  } catch (error) {
    throw error instanceof ShareError ? error : new ShareError(UNREADABLE)
  }
}

async function pack(text) {
  const plain = encoder.encode(text)
  if (plain.length > MAX_SHARED_BYTES) throw new ShareError(TOO_LARGE)
  const compressed = canCompress() ? await compress(plain) : plain
  return compressed.length < plain.length
    ? joinBytes(Uint8Array.of(PACKED_GZIP), compressed)
    : joinBytes(Uint8Array.of(PACKED_PLAIN), plain)
}

async function unpacked(packed) {
  const content = packed.subarray(1)
  if (packed[0] === PACKED_GZIP) return decompress(content)
  if (packed[0] === PACKED_PLAIN) return content
  throw new ShareError(UNREADABLE)
}

async function unpack(packed) {
  const content = await unpacked(packed)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content)
  } catch {
    throw new ShareError(UNREADABLE)
  }
}

const importKey = (bytes) => subtle().importKey('raw', bytes, CIPHER, false, KEY_USES)

async function deriveKey(passphrase, salt) {
  const material = await subtle().importKey('raw', encoder.encode(passphrase.normalize('NFKC')), DERIVATION, false, ['deriveKey'])
  return subtle().deriveKey(
    { name: DERIVATION, salt, iterations: DERIVATION_ROUNDS, hash: DERIVATION_HASH },
    material,
    { name: CIPHER, length: KEY_BITS },
    false,
    KEY_USES
  )
}

const cipherFor = (version, iv) => ({ name: CIPHER, iv, additionalData: encoder.encode(version) })

async function seal(key, version, packed) {
  const iv = randomBytes(IV_BYTES)
  const sealed = await subtle().encrypt(cipherFor(version, iv), key, packed)
  return toBase64Url(joinBytes(iv, new Uint8Array(sealed)))
}

async function sealWithKey(packed) {
  const keyBytes = randomBytes(KEY_BYTES)
  const data = await seal(await importKey(keyBytes), VERSION_KEY, packed)
  return { version: VERSION_KEY, secret: toBase64Url(keyBytes), data }
}

async function sealWithPassphrase(packed, passphrase) {
  const salt = randomBytes(SALT_BYTES)
  const data = await seal(await deriveKey(passphrase, salt), VERSION_PASSPHRASE, packed)
  return { version: VERSION_PASSPHRASE, secret: toBase64Url(salt), data }
}

export async function createShare(text, passphrase = '') {
  const packed = await pack(text)
  return passphrase ? sealWithPassphrase(packed, passphrase) : sealWithKey(packed)
}

const usesPassphrase = (share) => share.version === VERSION_PASSPHRASE

const referenceOf = ({ version, secret, data }) => [version, secret, data].join(PART_SEPARATOR)

export const shareKey = (share) => (usesPassphrase(share) ? '' : share.secret)

export const fragmentLength = (share) => FRAGMENT_NAME.length + referenceOf(share).length

export const fitsInLink = (share) => fragmentLength(share) <= MAX_LINK_FRAGMENT_LENGTH

export const shareLink = (appUrl, share) => `${appUrl}${LINK_MARKER}${referenceOf(share)}`

export const shareFileText = (share) => `${FILE_MARKER}${referenceOf({ ...share, secret: usesPassphrase(share) ? share.secret : '' })}`

export function findShareReference(text) {
  const linkStart = text.indexOf(LINK_MARKER)
  if (linkStart !== -1) return text.slice(linkStart + LINK_MARKER.length).replace(WHITESPACE, '')
  const trimmed = text.trimStart()
  return trimmed.startsWith(FILE_MARKER) ? trimmed.slice(FILE_MARKER.length).replace(WHITESPACE, '') : null
}

export function readShareReference(reference) {
  const parts = reference.split(PART_SEPARATOR)
  const [version, secret, data] = parts
  if (!version) throw new ShareError(INCOMPLETE)
  if (!VERSIONS.includes(version)) throw unknownVersion(version)
  if (parts.length !== PART_COUNT) throw new ShareError(INCOMPLETE)
  return { version, secret, data }
}

export function credentialNeeded(share) {
  if (usesPassphrase(share)) return CREDENTIAL_PASSPHRASE
  return share.secret === '' ? CREDENTIAL_KEY : ''
}

function keyBytesOf(text, failure) {
  if (text.length !== KEY_TEXT_LENGTH || !BASE64URL.test(text)) throw new ShareError(failure)
  return fromBase64Url(text)
}

function unlockingKey(share, credential, failure) {
  if (usesPassphrase(share)) return deriveKey(credential, fromBase64Url(share.secret))
  return importKey(keyBytesOf(share.secret || credential.trim(), failure))
}

async function unseal(key, version, sealed, failure) {
  if (sealed.length < IV_BYTES + TAG_BYTES) throw new ShareError(INCOMPLETE)
  try {
    const opened = await subtle().decrypt(cipherFor(version, sealed.subarray(0, IV_BYTES)), key, sealed.subarray(IV_BYTES))
    return new Uint8Array(opened)
  } catch {
    throw new ShareError(failure)
  }
}

export async function openShare(share, credential = '') {
  const failure = FAILURES[credentialNeeded(share)]
  const key = await unlockingKey(share, credential, failure)
  return unpack(await unseal(key, share.version, fromBase64Url(share.data), failure))
}
