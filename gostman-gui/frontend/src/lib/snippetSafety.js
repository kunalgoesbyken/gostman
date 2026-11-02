const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const LINE_BREAK = /[\r\n]/
const FORM_FIELD_SYNTAX = /[=;]/
const FILE_READING_VALUE = /^[@<]/

export const UNSAFE_REQUEST_SNIPPET = 'Code cannot be generated for this request: its method, address, headers or form parts contain characters that would change meaning in a command line.'

const hasLineBreak = (text) => LINE_BREAK.test(text)

const isAbsoluteUrl = (url) => {
  try {
    return Boolean(new URL(url).protocol)
  } catch {
    return false
  }
}

const isSafeHeader = ({ key, value }) => TOKEN.test(key) && !hasLineBreak(value)

const isSafePart = (part) => {
  if (FORM_FIELD_SYNTAX.test(part.name) || hasLineBreak(part.name)) return false
  if (part.file === undefined) return !hasLineBreak(part.value)
  return !hasLineBreak(part.file) && !FORM_FIELD_SYNTAX.test(part.contentType) && !hasLineBreak(part.contentType)
}

export const isSafeRequest = ({ method, url, headers, parts = [] }) => (
  TOKEN.test(method) && isAbsoluteUrl(url) && headers.every(isSafeHeader) && parts.every(isSafePart)
)

export const readsFromFile = (value) => FILE_READING_VALUE.test(value)
