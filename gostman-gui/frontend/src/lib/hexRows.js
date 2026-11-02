export const HEX_ROW_BYTES = 16

const OFFSET_DIGITS = 8
const PRINTABLE_FIRST = 0x20
const PRINTABLE_LAST = 0x7e
const NON_PRINTABLE = '.'
const HEX_RADIX = 16

const pair = (byte) => byte.toString(HEX_RADIX).padStart(2, '0')

export const rowCount = (bytes) => Math.ceil(bytes.length / HEX_ROW_BYTES)

export function hexRow(bytes, index) {
  const start = index * HEX_ROW_BYTES
  const slice = bytes.subarray(start, start + HEX_ROW_BYTES)
  const cells = Array.from(slice, pair)
  const ascii = Array.from(slice, (byte) => (byte >= PRINTABLE_FIRST && byte <= PRINTABLE_LAST ? String.fromCharCode(byte) : NON_PRINTABLE)).join('')
  return { offset: start.toString(HEX_RADIX).padStart(OFFSET_DIGITS, '0'), cells, ascii }
}

export function visibleRange(scrollTop, viewportHeight, rowHeight, total, overscan) {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const last = Math.min(total, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
  return { first, last }
}
