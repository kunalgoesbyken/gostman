import { BinaryValue, ExtensionValue, readBigInt } from './values'

const MAX_DEPTH = 200
const TIMESTAMP_EXTENSION = -1
const MS_PER_SECOND = 1000
const NANOS_PER_MS = 1000000
const UINT32_RANGE = 4294967296

class Reader {
  constructor(bytes) {
    this.bytes = bytes
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.at = 0
  }

  take(count) {
    if (this.at + count > this.bytes.length) throw new RangeError('Unexpected end of data')
    const slice = this.bytes.subarray(this.at, this.at + count)
    this.at += count
    return slice
  }

  unsigned(width) {
    const start = this.at
    this.take(width)
    if (width === 1) return this.view.getUint8(start)
    if (width === 2) return this.view.getUint16(start)
    return this.view.getUint32(start)
  }

  text(count) {
    return new TextDecoder().decode(this.take(count))
  }
}

function readExtension(reader, size) {
  const type = reader.view.getInt8(reader.at)
  reader.take(1)
  const data = reader.take(size)
  if (type === TIMESTAMP_EXTENSION) return timestamp(data)
  return new ExtensionValue(type, data)
}

function timestamp(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (data.length === 4) return new Date(view.getUint32(0) * MS_PER_SECOND).toISOString()
  if (data.length === 8) {
    const packed = view.getBigUint64(0)
    const nanos = Number(packed >> 34n)
    const seconds = Number(packed & 0x3ffffffffn)
    return new Date(seconds * MS_PER_SECOND + Math.floor(nanos / NANOS_PER_MS)).toISOString()
  }
  if (data.length === 12) {
    const seconds = Number(view.getBigInt64(4))
    return new Date(seconds * MS_PER_SECOND + Math.floor(view.getUint32(0) / NANOS_PER_MS)).toISOString()
  }
  return new ExtensionValue(TIMESTAMP_EXTENSION, data)
}

function readArray(reader, count, depth) {
  const items = []
  for (let index = 0; index < count; index += 1) items.push(readValue(reader, depth + 1))
  return items
}

function readMap(reader, count, depth) {
  const entries = {}
  for (let index = 0; index < count; index += 1) {
    const key = readValue(reader, depth + 1)
    entries[typeof key === 'string' ? key : String(key)] = readValue(reader, depth + 1)
  }
  return entries
}

function readFixed(reader, code, depth) {
  if (code <= 0x7f) return code
  if (code >= 0xe0) return code - 0x100
  if (code <= 0x8f) return readMap(reader, code & 0x0f, depth)
  if (code <= 0x9f) return readArray(reader, code & 0x0f, depth)
  return reader.text(code & 0x1f)
}

function readWide(reader, code, depth) {
  switch (code) {
    case 0xc0: return null
    case 0xc2: return false
    case 0xc3: return true
    case 0xc4: return new BinaryValue(reader.take(reader.unsigned(1)))
    case 0xc5: return new BinaryValue(reader.take(reader.unsigned(2)))
    case 0xc6: return new BinaryValue(reader.take(reader.unsigned(4)))
    case 0xc7: return readExtension(reader, reader.unsigned(1))
    case 0xc8: return readExtension(reader, reader.unsigned(2))
    case 0xc9: return readExtension(reader, reader.unsigned(4))
    case 0xca: return numberFrom(reader.take(4), (view) => view.getFloat32(0))
    case 0xcb: return numberFrom(reader.take(8), (view) => view.getFloat64(0))
    case 0xcc: return reader.unsigned(1)
    case 0xcd: return reader.unsigned(2)
    case 0xce: return reader.unsigned(4)
    case 0xcf: return readBigInt(reader.take(8), false)
    case 0xd0: return numberFrom(reader.take(1), (view) => view.getInt8(0))
    case 0xd1: return numberFrom(reader.take(2), (view) => view.getInt16(0))
    case 0xd2: return numberFrom(reader.take(4), (view) => view.getInt32(0))
    case 0xd3: return readBigInt(reader.take(8), true)
    case 0xd4: return readExtension(reader, 1)
    case 0xd5: return readExtension(reader, 2)
    case 0xd6: return readExtension(reader, 4)
    case 0xd7: return readExtension(reader, 8)
    case 0xd8: return readExtension(reader, 16)
    case 0xd9: return reader.text(reader.unsigned(1))
    case 0xda: return reader.text(reader.unsigned(2))
    case 0xdb: return reader.text(reader.unsigned(4))
    case 0xdc: return readArray(reader, reader.unsigned(2), depth)
    case 0xdd: return readArray(reader, reader.unsigned(4), depth)
    case 0xde: return readMap(reader, reader.unsigned(2), depth)
    case 0xdf: return readMap(reader, reader.unsigned(4), depth)
    default: throw new SyntaxError(`Unknown MessagePack type 0x${code.toString(16)}`)
  }
}

function numberFrom(slice, read) {
  return read(new DataView(slice.buffer, slice.byteOffset, slice.byteLength))
}

function readValue(reader, depth) {
  if (depth > MAX_DEPTH) throw new RangeError('Nesting is too deep')
  const code = reader.unsigned(1)
  if (code < 0xc0 || code >= 0xe0) return readFixed(reader, code, depth)
  return readWide(reader, code, depth)
}

export function decodeMessagePack(bytes) {
  const reader = new Reader(bytes)
  const value = readValue(reader, 0)
  if (reader.at !== bytes.length) throw new SyntaxError(`${bytes.length - reader.at} bytes remain after the first value`)
  return value
}

class Writer {
  constructor() {
    this.chunks = []
    this.size = 0
  }

  push(bytes) {
    this.chunks.push(bytes)
    this.size += bytes.length
  }

  head(code, width, value) {
    const bytes = new Uint8Array(1 + width)
    bytes[0] = code
    const view = new DataView(bytes.buffer)
    if (width === 1) view.setUint8(1, value)
    if (width === 2) view.setUint16(1, value)
    if (width === 4) view.setUint32(1, value)
    this.push(bytes)
  }

  finish() {
    const out = new Uint8Array(this.size)
    let offset = 0
    for (const chunk of this.chunks) {
      out.set(chunk, offset)
      offset += chunk.length
    }
    return out
  }
}

function writeSized(writer, count, fixBase, fixLimit, codes) {
  if (count <= fixLimit) writer.push(Uint8Array.of(fixBase | count))
  else if (codes[0] && count < 256) writer.head(codes[0], 1, count)
  else if (count < 65536) writer.head(codes[1], 2, count)
  else writer.head(codes[2], 4, count)
}

function writeInteger(writer, value) {
  if (value >= 0 && value < 128) return writer.push(Uint8Array.of(value))
  if (value < 0 && value >= -32) return writer.push(Uint8Array.of(value + 0x100))
  const bytes = new Uint8Array(9)
  const view = new DataView(bytes.buffer)
  if (value >= 0 && value < UINT32_RANGE) {
    if (value < 256) return writer.head(0xcc, 1, value)
    if (value < 65536) return writer.head(0xcd, 2, value)
    return writer.head(0xce, 4, value)
  }
  if (value >= 0) view.setBigUint64(1, BigInt(value))
  else view.setBigInt64(1, BigInt(value))
  bytes[0] = value >= 0 ? 0xcf : 0xd3
  return writer.push(bytes)
}

function writeNumber(writer, value) {
  if (Number.isSafeInteger(value)) return writeInteger(writer, value)
  const bytes = new Uint8Array(9)
  bytes[0] = 0xcb
  new DataView(bytes.buffer).setFloat64(1, value)
  return writer.push(bytes)
}

function writeString(writer, text) {
  const encoded = new TextEncoder().encode(text)
  writeSized(writer, encoded.length, 0xa0, 31, [0xd9, 0xda, 0xdb])
  writer.push(encoded)
}

function writeValue(writer, value) {
  if (value === null || value === undefined) return writer.push(Uint8Array.of(0xc0))
  if (typeof value === 'boolean') return writer.push(Uint8Array.of(value ? 0xc3 : 0xc2))
  if (typeof value === 'number') return writeNumber(writer, value)
  if (typeof value === 'string') return writeString(writer, value)
  if (Array.isArray(value)) {
    writeSized(writer, value.length, 0x90, 15, [0, 0xdc, 0xdd])
    return value.forEach((item) => writeValue(writer, item))
  }
  const keys = Object.keys(value)
  writeSized(writer, keys.length, 0x80, 15, [0, 0xde, 0xdf])
  return keys.forEach((key) => {
    writeString(writer, key)
    writeValue(writer, value[key])
  })
}

export function encodeMessagePack(value) {
  const writer = new Writer()
  writeValue(writer, value)
  return writer.finish()
}
