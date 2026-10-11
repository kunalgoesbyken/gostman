import { base64ByteLength } from './base64'
import { formatSize, isPlainObject, parseJSON } from './dataUtils'

const MAX_EXAMPLES = 20
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_NAME_LENGTH = 120
const ENCODING_BASE64 = 'base64'
const ENCODING_UTF8 = 'utf8'
const DEFAULT_STATUS = 200
const UNSAVED_HEADERS = ['set-cookie', 'authorization', 'proxy-authenticate', 'www-authenticate']

const asText = (value) => (typeof value === 'string' ? value : '')

const toHeader = (raw) => ({ key: asText(raw?.key), value: asText(raw?.value) })

const isShareableHeader = (header) => !UNSAVED_HEADERS.includes(header.key.trim().toLowerCase())

const toHeaders = (raw) => (Array.isArray(raw) ? raw.map(toHeader).filter(isShareableHeader) : [])

const isStored = (raw) => isPlainObject(raw) && typeof raw.id === 'string' && raw.id !== ''

const toExample = (raw) => ({
  id: raw.id,
  name: asText(raw.name),
  status: Number.isInteger(raw.status) ? raw.status : DEFAULT_STATUS,
  headers: toHeaders(raw.headers),
  body: asText(raw.body),
  bodyEncoding: raw.bodyEncoding === ENCODING_BASE64 ? ENCODING_BASE64 : ENCODING_UTF8,
  contentType: asText(raw.contentType),
  isDefault: raw.isDefault === true,
})

export function parseExamples(json) {
  const stored = parseJSON(json, [])
  return Array.isArray(stored) ? stored.filter(isStored).map(toExample) : []
}

export const serializeExamples = (examples) => (examples.length > 0 ? JSON.stringify(examples) : '')

export const sanitizeExamples = (json) => serializeExamples(parseExamples(json).slice(0, MAX_EXAMPLES))

export const canSaveAsExample = (response) => Boolean(response) && !response.error && !response.protocol

export const isBinaryExample = (example) => example.bodyEncoding === ENCODING_BASE64

export const exampleSize = (example) => (
  isBinaryExample(example) ? base64ByteLength(example.body) : new TextEncoder().encode(example.body).length
)

export const servedByDefault = (examples) => examples.find((example) => example.isDefault) || examples[0]

function withinBodyLimit(example) {
  const size = exampleSize(example)
  if (size <= MAX_BODY_BYTES) return example
  throw new Error(`This body is ${formatSize(size)}. An example keeps a body of up to ${formatSize(MAX_BODY_BYTES)}.`)
}

export const cleanExampleName = (name, fallback) => asText(name).trim().slice(0, MAX_NAME_LENGTH) || fallback

export function exampleFromResponse(response, name) {
  return withinBodyLimit({
    id: crypto.randomUUID(),
    name: cleanExampleName(name, response.status),
    status: response.statusCode,
    headers: toHeaders(response.headers),
    body: response.body,
    bodyEncoding: response.bodyEncoding === ENCODING_BASE64 ? ENCODING_BASE64 : ENCODING_UTF8,
    contentType: response.contentType,
    isDefault: false,
  })
}

export function withExample(examples, example) {
  if (examples.length >= MAX_EXAMPLES) {
    throw new Error(`A request keeps up to ${MAX_EXAMPLES} examples. Delete one to save another.`)
  }
  return [...examples, { ...example, isDefault: examples.length === 0 }]
}

const mapExample = (examples, id, update) => examples.map((example) => (example.id === id ? update(example) : example))

export const renameExample = (examples, id, name) => mapExample(examples, id, (example) => ({ ...example, name }))

export const withExampleBody = (examples, id, body) => mapExample(examples, id, (example) => withinBodyLimit({ ...example, body }))

export const withDefaultExample = (examples, id) => examples.map((example) => ({ ...example, isDefault: example.id === id }))

export const withoutExample = (examples, id) => examples.filter((example) => example.id !== id)
