import { bytesToBase64 } from '../base64'

export const MAX_DEPTH = 64
export const MAX_BIGNUM_BYTES = 64

export function checkCount(count, remaining, minimumBytes) {
  if (BigInt(count) * BigInt(minimumBytes) > BigInt(remaining)) throw new RangeError('A length in the data is larger than the data itself')
}

export class BinaryValue {
  constructor(bytes) {
    this.bytes = bytes
  }
}

export class ExtensionValue {
  constructor(type, bytes) {
    this.type = type
    this.bytes = bytes
  }
}

export class TaggedValue {
  constructor(tag, value) {
    this.tag = tag
    this.value = value
  }
}

export function readBigInt(slice, signed) {
  const view = new DataView(slice.buffer, slice.byteOffset, slice.byteLength)
  const value = signed ? view.getBigInt64(0) : view.getBigUint64(0)
  return Number.isSafeInteger(Number(value)) && BigInt(Number(value)) === value ? Number(value) : value
}

function replacer(_key, value) {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof BinaryValue) return { $binary: bytesToBase64(value.bytes) }
  if (value instanceof ExtensionValue) return { $extension: value.type, data: bytesToBase64(value.bytes) }
  if (value instanceof TaggedValue) return { $tag: value.tag, value: value.value }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
  return value
}

export function decodedJson(value) {
  return JSON.stringify(value, replacer, 2) ?? 'null'
}
