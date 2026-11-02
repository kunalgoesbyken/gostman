import { BinaryValue, MAX_BIGNUM_BYTES, MAX_DEPTH, TaggedValue, checkCount } from './values'

const BREAK = Symbol('break')
const TAG_DATE_TEXT = 0
const TAG_DATE_EPOCH = 1
const TAG_POSITIVE_BIGNUM = 2
const TAG_NEGATIVE_BIGNUM = 3
const TAG_SELF_DESCRIBE = 55799
const MS_PER_SECOND = 1000
const UINT32_RANGE = 4294967296
const SIMPLE_NEXT_BYTE = 24
const INDEFINITE = 31

class Reader {
  constructor(bytes) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.at = 0
  }

  take(count) {
    if (count > this.bytes.length - this.at) throw new RangeError('Unexpected end of data')
    const start = this.at
    this.at += count
    return this.bytes.subarray(start, this.at)
  }

  byte() {
    return this.take(1)[0]
  }

  read(width, getter) {
    const start = this.at
    this.take(width)
    return getter.call(this.view, start)
  }

  argument(info) {
    if (info < 24) return info
    if (info === 24) return this.byte()
    if (info === 25) return this.read(2, DataView.prototype.getUint16)
    if (info === 26) return this.read(4, DataView.prototype.getUint32)
    if (info === 27) return this.bigArgument()
    throw new SyntaxError(`Invalid additional information ${info}`)
  }

  bigArgument() {
    const value = this.read(8, DataView.prototype.getBigUint64)
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value
  }
}

function halfFloat(bits) {
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  const sign = bits & 0x8000 ? -1 : 1
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024)
  if (exponent === 31) return fraction ? NaN : sign * Infinity
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

function joinChunks(reader, major, depth) {
  const parts = []
  for (;;) {
    const item = readItem(reader, depth + 1)
    if (item === BREAK) break
    if (!(item instanceof BinaryValue) && typeof item !== 'string') throw new SyntaxError('Invalid chunk in indefinite string')
    parts.push(item)
  }
  if (major === 3) return parts.join('')
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.bytes.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part.bytes, offset)
    offset += part.bytes.length
  }
  return new BinaryValue(joined)
}

function readArray(reader, count, depth) {
  const items = []
  if (count !== null) checkCount(count, reader.bytes.length - reader.at, 1)
  if (count === null) {
    for (;;) {
      const item = readItem(reader, depth + 1)
      if (item === BREAK) return items
      items.push(item)
    }
  }
  for (let index = 0; index < count; index += 1) items.push(readItem(reader, depth + 1))
  return items
}

function readMap(reader, count, depth) {
  const result = {}
  if (count !== null) checkCount(count, reader.bytes.length - reader.at, 2)
  const store = (key, value) => {
    result[typeof key === 'string' ? key : String(key)] = value
  }
  if (count === null) {
    for (;;) {
      const key = readItem(reader, depth + 1)
      if (key === BREAK) return result
      store(key, readItem(reader, depth + 1))
    }
  }
  for (let index = 0; index < count; index += 1) {
    const key = readItem(reader, depth + 1)
    store(key, readItem(reader, depth + 1))
  }
  return result
}

function bignum(bytes, negative) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const value = hex === '' ? 0n : BigInt(`0x${hex}`)
  const result = negative ? -1n - value : value
  return Number.isSafeInteger(Number(result)) && BigInt(Number(result)) === result ? Number(result) : result
}

function tagged(tag, value) {
  if (tag === TAG_SELF_DESCRIBE) return value
  if (tag === TAG_DATE_TEXT && typeof value === 'string') return value
  if (tag === TAG_DATE_EPOCH && typeof value === 'number') return new Date(value * MS_PER_SECOND).toISOString()
  const small = value instanceof BinaryValue && value.bytes.length <= MAX_BIGNUM_BYTES
  if (tag === TAG_POSITIVE_BIGNUM && small) return bignum(value.bytes, false)
  if (tag === TAG_NEGATIVE_BIGNUM && small) return bignum(value.bytes, true)
  return new TaggedValue(tag, value)
}

function readSimple(reader, info) {
  if (info === 20) return false
  if (info === 21) return true
  if (info === 22 || info === 23) return null
  if (info === 25) return halfFloat(reader.read(2, DataView.prototype.getUint16))
  if (info === 26) return reader.read(4, DataView.prototype.getFloat32)
  if (info === 27) return reader.read(8, DataView.prototype.getFloat64)
  if (info === INDEFINITE) return BREAK
  if (info === SIMPLE_NEXT_BYTE) return new TaggedValue('simple', reader.byte())
  return new TaggedValue('simple', info)
}

function readItem(reader, depth) {
  if (depth > MAX_DEPTH) throw new RangeError('Nesting is too deep')
  const initial = reader.byte()
  const major = initial >> 5
  const info = initial & 0x1f
  if (major === 7) return readSimple(reader, info)
  const indefinite = info === INDEFINITE
  if (indefinite && major <= 1) throw new SyntaxError('Invalid additional information 31')
  const argument = indefinite ? null : reader.argument(info)
  if (major === 0) return argument
  if (major === 1) return typeof argument === 'bigint' ? -1n - argument : -1 - argument
  if (major === 2) return indefinite ? joinChunks(reader, 2, depth) : new BinaryValue(reader.take(argument))
  if (major === 3) return indefinite ? joinChunks(reader, 3, depth) : new TextDecoder().decode(reader.take(argument))
  if (major === 4) return readArray(reader, argument, depth)
  if (major === 5) return readMap(reader, argument, depth)
  return tagged(argument, readItem(reader, depth + 1))
}

export function decodeCbor(bytes) {
  const reader = new Reader(bytes)
  const value = readItem(reader, 0)
  if (value === BREAK) throw new SyntaxError('Unexpected break')
  if (reader.at !== bytes.length) throw new SyntaxError(`${bytes.length - reader.at} bytes remain after the first value`)
  return value
}

function head(major, value, out) {
  const type = major << 5
  if (value < 24) return out.push(Uint8Array.of(type | value))
  if (value < 256) return out.push(Uint8Array.of(type | 24, value))
  if (value < 65536) return out.push(Uint8Array.of(type | 25, value >> 8, value & 0xff))
  const wide = value >= UINT32_RANGE
  const bytes = new Uint8Array(wide ? 9 : 5)
  const view = new DataView(bytes.buffer)
  bytes[0] = type | (wide ? 27 : 26)
  if (wide) view.setBigUint64(1, BigInt(value))
  else view.setUint32(1, value)
  return out.push(bytes)
}

function writeNumber(value, out) {
  if (Number.isSafeInteger(value)) return value >= 0 ? head(0, value, out) : head(1, -1 - value, out)
  const bytes = new Uint8Array(9)
  bytes[0] = 0xfb
  new DataView(bytes.buffer).setFloat64(1, value)
  return out.push(bytes)
}

function writeItem(value, out) {
  if (value === null || value === undefined) return out.push(Uint8Array.of(0xf6))
  if (typeof value === 'boolean') return out.push(Uint8Array.of(value ? 0xf5 : 0xf4))
  if (typeof value === 'number') return writeNumber(value, out)
  if (typeof value === 'string') {
    const encoded = new TextEncoder().encode(value)
    head(3, encoded.length, out)
    return out.push(encoded)
  }
  if (Array.isArray(value)) {
    head(4, value.length, out)
    return value.forEach((item) => writeItem(item, out))
  }
  const keys = Object.keys(value)
  head(5, keys.length, out)
  return keys.forEach((key) => {
    writeItem(key, out)
    writeItem(value[key], out)
  })
}

export function encodeCbor(value) {
  const out = []
  writeItem(value, out)
  const bytes = new Uint8Array(out.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of out) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
