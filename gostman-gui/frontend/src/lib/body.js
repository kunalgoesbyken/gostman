import { BODY_TEXT as LABEL_TEXT } from './bodyText'

export const BODY_NONE = 'none'
export const BODY_JSON = 'json'
export const BODY_TEXT = 'text'
export const BODY_XML = 'xml'
export const BODY_FORM = 'form'
export const BODY_MULTIPART = 'multipart'
export const BODY_BINARY = 'binary'
export const BODY_SOAP = 'soap'

export const BODY_TYPES = [
  { value: BODY_NONE, get label() { return LABEL_TEXT.types.none } },
  { value: BODY_JSON, label: 'JSON' },
  { value: BODY_TEXT, get label() { return LABEL_TEXT.types.text } },
  { value: BODY_XML, label: 'XML' },
  { value: BODY_SOAP, label: 'SOAP' },
  { value: BODY_FORM, get label() { return LABEL_TEXT.types.form } },
  { value: BODY_MULTIPART, get label() { return LABEL_TEXT.types.multipart } },
  { value: BODY_BINARY, get label() { return LABEL_TEXT.types.file } },
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
