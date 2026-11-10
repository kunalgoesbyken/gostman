import { BODY_JSON, BODY_TEXT, BODY_TYPES, BODY_XML } from './body'

const JSON_START = /^\s*(?:\[|\{(?!\{))/
const XML_START = /^\s*</
const DOCUMENT_TYPES = [BODY_TEXT, BODY_JSON, BODY_XML]

export const documentTypeOptions = () => BODY_TYPES.filter((type) => DOCUMENT_TYPES.includes(type.value))

export function documentTypeOf(text) {
  if (JSON_START.test(text)) return BODY_JSON
  return XML_START.test(text) ? BODY_XML : BODY_TEXT
}
