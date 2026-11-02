export const BINARY_FORMATS = {
  msgpack: { contentType: 'application/msgpack', extension: 'msgpack', types: ['msgpack', 'messagepack'] },
  cbor: { contentType: 'application/cbor', extension: 'cbor', types: ['cbor'] },
}

export const FORMAT_NAMES = Object.keys(BINARY_FORMATS)

export const isFormat = (name) => Object.hasOwn(BINARY_FORMATS, name)

export function formatForContentType(contentType) {
  const type = (contentType || '').toLowerCase()
  return FORMAT_NAMES.find((name) => BINARY_FORMATS[name].types.some((marker) => type.includes(marker))) ?? null
}
