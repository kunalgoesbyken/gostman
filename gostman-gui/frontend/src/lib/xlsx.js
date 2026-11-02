const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_HEADER = 0x04034b50
const STORED = 0
const DEFLATED = 8
const MAX_PART_BYTES = 64 * 1024 * 1024
const MAIN_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const RELATIONSHIP_ATTRIBUTE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export class WorkbookError extends Error {}

function findEndOfDirectory(view) {
  const earliest = Math.max(0, view.byteLength - 65557)
  for (let offset = view.byteLength - 22; offset >= earliest; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_DIRECTORY) return offset
  }
  throw new WorkbookError('not a workbook')
}

function readDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEndOfDirectory(view)
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const entries = new Map()
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== DIRECTORY_ENTRY) throw new WorkbookError('not a workbook')
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
    })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function inflate(compressed) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_PART_BYTES) {
      await reader.cancel()
      throw new WorkbookError('too large')
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer())
}

async function readPart(bytes, entries, name) {
  const entry = entries.get(name)
  if (!entry) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(entry.localOffset, true) !== LOCAL_HEADER) throw new WorkbookError('not a workbook')
  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true)
  const data = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === STORED) return new TextDecoder().decode(data)
  if (entry.method === DEFLATED) return inflate(data)
  throw new WorkbookError('unsupported compression')
}

const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml')

const children = (parent, name) => [...parent.getElementsByTagNameNS(MAIN_NAMESPACE, name)]

const richText = (element) => children(element, 't').map((node) => node.textContent).join('')

function firstSheetPath(workbook, relationships) {
  const [sheet] = children(workbook, 'sheet')
  if (!sheet) throw new WorkbookError('no sheets')
  const id = sheet.getAttributeNS(RELATIONSHIP_ATTRIBUTE, 'id')
  const match = relationships && [...relationships.getElementsByTagName('Relationship')].find((item) => item.getAttribute('Id') === id)
  const target = match?.getAttribute('Target')
  if (!target) return 'xl/worksheets/sheet1.xml'
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`
}

function columnIndex(reference) {
  const letters = /^[A-Z]+/.exec(reference || '')
  if (!letters) return -1
  return [...letters[0]].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function cellText(cell, shared) {
  const type = cell.getAttribute('t')
  const value = children(cell, 'v')[0]?.textContent ?? ''
  if (type === 's') return shared[Number(value)] ?? ''
  if (type === 'inlineStr') return richText(cell)
  if (type === 'b') return value.trim() === '1' ? 'true' : 'false'
  return value.trim()
}

function sheetTable(sheet, shared) {
  return children(sheet, 'row').map((row) => {
    const line = []
    for (const cell of children(row, 'c')) {
      const position = columnIndex(cell.getAttribute('r'))
      const column = position < 0 ? line.length : position
      while (line.length <= column) line.push('')
      line[column] = cellText(cell, shared)
    }
    return line
  })
}

export async function readWorkbookRows(buffer) {
  const bytes = new Uint8Array(buffer)
  const entries = readDirectory(bytes)
  const workbookText = await readPart(bytes, entries, 'xl/workbook.xml')
  if (!workbookText) throw new WorkbookError('not a workbook')
  const relationshipsText = await readPart(bytes, entries, 'xl/_rels/workbook.xml.rels')
  const sheetText = await readPart(
    bytes,
    entries,
    firstSheetPath(parseXml(workbookText), relationshipsText && parseXml(relationshipsText)),
  )
  if (!sheetText) throw new WorkbookError('no sheets')
  const sharedText = await readPart(bytes, entries, 'xl/sharedStrings.xml')
  const shared = sharedText ? children(parseXml(sharedText), 'si').map(richText) : []
  const [header = [], ...lines] = sheetTable(parseXml(sheetText), shared)
  const names = header.map((name) => name.trim())
  return lines
    .filter((line) => line.some((value) => value.trim() !== ''))
    .map((line) => Object.fromEntries(names.flatMap((name, index) => (name ? [[name, line[index] ?? '']] : []))))
}
