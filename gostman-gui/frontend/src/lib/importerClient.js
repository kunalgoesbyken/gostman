import { MAX_FILE_SIZE } from './importExport'
import { formatSize } from './dataUtils'
import { IMPORT_TEXT } from './importText'
import { readZip } from './zipReader'

const MAX_FILES = 5000
const MAX_DEPTH = 32
const IMPORTABLE = new Set(['bru', 'json', 'yml', 'yaml', 'xml', 'wsdl', 'xsd', 'har', 'http', 'rest', 'proto'])
const SKIPPED_SEGMENTS = ['node_modules']
const BOM_LABELS = [
  { bytes: [0xff, 0xfe], label: 'utf-16le' },
  { bytes: [0xfe, 0xff], label: 'utf-16be' },
]

const isHiddenPath = (name) => name.split('/').some((segment) => segment.startsWith('.') || SKIPPED_SEGMENTS.includes(segment))

const encodingOf = (bytes) => BOM_LABELS.find(({ bytes: mark }) => mark.every((byte, index) => bytes[index] === byte))?.label || 'utf-8'

const extensionOf = (name) => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

const NUL = String.fromCharCode(0)

function decode(entry, buffer) {
  const failure = new Error(IMPORT_TEXT.binaryFailure(entry.name))
  let text
  try {
    text = new TextDecoder(encodingOf(new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))), { fatal: true }).decode(buffer)
  } catch {
    throw failure
  }
  if (text.includes(NUL)) throw failure
  return text
}

async function readText(entry) {
  return { name: entry.name, text: decode(entry, await entry.file.arrayBuffer()) }
}

export const pickedEntries = (fileList) => Array.from(fileList, (file) => ({ file, name: file.webkitRelativePath || file.name }))

async function listDirectory(reader) {
  const found = []
  for (let batch = await readBatch(reader); batch.length > 0; batch = await readBatch(reader)) found.push(...batch)
  return found
}

const readBatch = (reader) => new Promise((resolve, reject) => reader.readEntries(resolve, reject))

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject))

async function walk(entry, depth, found) {
  if (found.length > MAX_FILES || depth > MAX_DEPTH) return
  if (entry.isFile) {
    found.push({ file: await fileOf(entry), name: entry.fullPath.replace(/^\//, '') })
    return
  }
  for (const child of await listDirectory(entry.createReader())) await walk(child, depth + 1, found)
}

export async function droppedEntries(dataTransfer) {
  const roots = Array.from(dataTransfer.items || [], (item) => item.webkitGetAsEntry?.()).filter(Boolean)
  if (roots.length === 0) return pickedEntries(dataTransfer.files)
  const found = []
  for (const root of roots) await walk(root, 0, found)
  return found
}

const isArchive = ({ name }) => extensionOf(name) === 'zip'

async function expandArchives(entries) {
  const expanded = []
  for (const entry of entries) {
    if (!isArchive(entry)) {
      expanded.push(entry)
      continue
    }
    if (entry.file.size > MAX_FILE_SIZE) throw new Error(IMPORT_TEXT.tooLarge(entry.name, formatSize(entry.file.size), formatSize(MAX_FILE_SIZE)))
    expanded.push(...await readZip(await entry.file.arrayBuffer(), { files: MAX_FILES, bytes: MAX_FILE_SIZE }))
  }
  return expanded
}

export async function readImportFiles(given) {
  let entries
  try {
    entries = await expandArchives(given)
  } catch (error) {
    return { error: error.message }
  }
  const relevant = entries.length === 1 && !isArchive(given[0]) ? entries : entries.filter(({ name }) => IMPORTABLE.has(extensionOf(name)) && !isHiddenPath(name))
  if (relevant.length === 0) return { error: IMPORT_TEXT.noFiles }
  if (relevant.length > MAX_FILES) return { error: IMPORT_TEXT.tooMany(MAX_FILES) }
  const oversized = relevant.find(({ file }) => file.size > MAX_FILE_SIZE)
  if (oversized) return { error: IMPORT_TEXT.tooLarge(oversized.name, formatSize(oversized.file.size), formatSize(MAX_FILE_SIZE)) }
  if (relevant.reduce((total, { file }) => total + file.size, 0) > MAX_FILE_SIZE) return { error: IMPORT_TEXT.totalTooLarge(formatSize(MAX_FILE_SIZE)) }
  try {
    return { files: await Promise.all(relevant.map(readText)) }
  } catch (error) {
    return { error: error.message }
  }
}

export function createImporterClient(backend) {
  async function ask(query) {
    const reply = await backend.importer(query)
    if (reply.error) throw new Error(reply.error)
    return reply
  }

  async function read(files, format, options) {
    try {
      const reply = await ask({ action: 'import', format, files, options })
      return { success: true, ...reply, label: reply.sources.map((source) => source.name).join(', ') }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const build = (format, collection, options) => ask({ action: 'export', format, collection, options })

  const adapt = (target, collection) => ask({ action: 'adapt', format: target, collection })

  return { read, build, adapt }
}
