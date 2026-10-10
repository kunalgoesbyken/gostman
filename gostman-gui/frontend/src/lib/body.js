export const BODY_NONE = 'none'
export const BODY_JSON = 'json'
export const BODY_TEXT = 'text'
export const BODY_XML = 'xml'
export const BODY_FORM = 'form'
export const BODY_MULTIPART = 'multipart'
export const BODY_BINARY = 'binary'

export const BODY_TYPES = [
  { value: BODY_NONE, label: 'None' },
  { value: BODY_JSON, label: 'JSON' },
  { value: BODY_TEXT, label: 'Text' },
  { value: BODY_XML, label: 'XML' },
  { value: BODY_FORM, label: 'Form URL-encoded' },
  { value: BODY_MULTIPART, label: 'Multipart' },
  { value: BODY_BINARY, label: 'File' },
]

const RAW_KIND = 'raw'
const STRUCTURED_TYPES = [BODY_NONE, BODY_FORM, BODY_MULTIPART, BODY_BINARY]

const isJSON = (text) => {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

const kindOf = (bodyType) => (STRUCTURED_TYPES.includes(bodyType) ? bodyType : RAW_KIND)

export function resolveBodyType(bodyType, body) {
  if (bodyType) return bodyType
  return body.trim() === '' || isJSON(body) ? BODY_JSON : BODY_TEXT
}

export function switchBodyType(request, drafts, bodyType) {
  const current = kindOf(request.bodyType)
  const next = kindOf(bodyType)
  if (current === next) return { updates: { bodyType }, drafts }
  const stashed = { ...drafts, [current]: request.body }
  return { updates: { bodyType, body: stashed[next] || '' }, drafts: stashed }
}
