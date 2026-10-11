export const CURL_RAW = 'raw'
export const CURL_FORM = 'form'
export const CURL_MULTIPART = 'multipart'
export const CURL_FILE = 'file'

const HEAD = 'HEAD'
const BARE_WORD = /^[A-Za-z]+$/
const LINE_BREAK = ' \\\n  '

const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

const isHeaderName = (name) => HEADER_NAME.test(name)

const baseName = (fileName) => fileName.split('/').pop().split('\\').pop()

const shellWord = (text) => (BARE_WORD.test(text) ? text : shellQuote(text))

const methodFlag = (method) => (method === HEAD ? '--head' : `-X ${shellWord(method)}`)

const LINE_BREAKS = /[
]+/g

const singleLine = (text) => text.replace(LINE_BREAKS, ' ')

const headerLine = ({ key, value }) => (value === '' ? `${key};` : `${key}: ${singleLine(value)}`)

const assignment = ({ key, value }) => `${key}=${value}`

const multipartFlag = (field) => (
  field.fileName === undefined
    ? `--form-string ${shellQuote(assignment(field))}`
    : `-F ${shellQuote(`${field.key}=@${baseName(field.fileName)}`)}`
)

const BODY_FLAGS = {
  [CURL_RAW]: (body) => [`--data-raw ${shellQuote(body.text)}`],
  [CURL_FORM]: (body) => body.fields.map((field) => `--data-urlencode ${shellQuote(assignment(field))}`),
  [CURL_MULTIPART]: (body) => body.fields.map(multipartFlag),
  [CURL_FILE]: (body) => [`--data-binary ${shellQuote(`@${baseName(body.fileName)}`)}`],
}

export function curlCommand({ method, url, user, headers, body }) {
  return [
    `curl ${methodFlag(method)} --url ${shellQuote(url)}`,
    ...(user ? [`-u ${shellQuote(user)}`] : []),
    ...headers.filter((header) => isHeaderName(header.key)).map((header) => `-H ${shellQuote(headerLine(header))}`),
    ...(body ? BODY_FLAGS[body.kind](body) : []),
  ].join(LINE_BREAK)
}
