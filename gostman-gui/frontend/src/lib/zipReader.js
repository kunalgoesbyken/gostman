const END_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const LOCAL_SIGNATURE = 0x04034b50
const END_RECORD_BYTES = 22
const MAX_COMMENT_BYTES = 65_535
const CENTRAL_HEADER_BYTES = 46
const LOCAL_HEADER_BYTES = 30
const METHOD_STORED = 0
const METHOD_DEFLATE = 8
const FLAG_ENCRYPTED = 1

export const ZIP_ERRORS = {
  notZip: 'The archive could not be read as a zip file.',
  unsupported: 'The archive uses encryption, zip64 or a compression method that is not supported.',
  tooMany: (limit) => `The archive has more than ${limit} files.`,
  tooLarge: (limit) => `The archive expands to more than ${limit} bytes.`,
}

const isSafeName = (name) => name !== '' && !name.startsWith('/') && !name.includes('\\') && !name.includes(':') && !name.split('/').some((part) => part === '..')

function findEnd(view) {
  const lowest = Math.max(0, view.byteLength - END_RECORD_BYTES - MAX_COMMENT_BYTES)
  for (let offset = view.byteLength - END_RECORD_BYTES; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === END_SIGNATURE) return offset
  }
  throw new Error(ZIP_ERRORS.notZip)
}

function listEntries(view, bytes, limits) {
  const end = findEnd(view)
  const count = view.getUint16(end + 10, true)
  if (count === 0xffff) throw new Error(ZIP_ERRORS.unsupported)
  if (count > limits.files) throw new Error(ZIP_ERRORS.tooMany(limits.files))
  const decoder = new TextDecoder()
  const entries = []
  let offset = view.getUint32(end + 16, true)
  for (let index = 0; index < count; index += 1) {
    if (offset + CENTRAL_HEADER_BYTES > view.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error(ZIP_ERRORS.notZip)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    entries.push({
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      local: view.getUint32(offset + 42, true),
      name: decoder.decode(bytes.subarray(offset + CENTRAL_HEADER_BYTES, offset + CENTRAL_HEADER_BYTES + nameLength)),
    })
    offset += CENTRAL_HEADER_BYTES + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflate(compressed, limit) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks = []
  let total = 0
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    total += chunk.value.length
    if (total > limit) {
      await reader.cancel()
      throw new Error(ZIP_ERRORS.tooLarge(limit))
    }
    chunks.push(chunk.value)
  }
  return new Blob(chunks)
}

async function extract(entry, view, bytes, limit) {
  if (entry.flags & FLAG_ENCRYPTED) throw new Error(ZIP_ERRORS.unsupported)
  if (entry.size > limit) throw new Error(ZIP_ERRORS.tooLarge(limit))
  if (entry.local + LOCAL_HEADER_BYTES > view.byteLength || view.getUint32(entry.local, true) !== LOCAL_SIGNATURE) throw new Error(ZIP_ERRORS.notZip)
  const start = entry.local + LOCAL_HEADER_BYTES + view.getUint16(entry.local + 26, true) + view.getUint16(entry.local + 28, true)
  const compressed = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === METHOD_STORED) return new Blob([compressed])
  if (entry.method === METHOD_DEFLATE) return inflate(compressed, limit)
  throw new Error(ZIP_ERRORS.unsupported)
}

export async function readZip(buffer, limits) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const files = []
  let remaining = limits.bytes
  for (const entry of listEntries(view, bytes, limits)) {
    if (entry.name.endsWith('/') || !isSafeName(entry.name)) continue
    const blob = await extract(entry, view, bytes, remaining)
    remaining -= blob.size
    files.push({ name: entry.name, file: new File([blob], entry.name) })
  }
  return files
}
