export const CURL_RAW = 'raw'
export const CURL_FORM = 'form'
export const CURL_MULTIPART = 'multipart'
export const CURL_FILE = 'file'

const HEAD = 'HEAD'
const BARE_WORD = /^[A-Za-z]+$/
const LINE_BREAK = ' \\\n  '

const shellQuote = (text) => `'${text.replaceAll("'", `'\\''`)}'`

const shellWord = (text) => (BARE_WORD.test(text) ? text : shellQuote(text))

const methodFlag = (method) => (method === HEAD ? '--head' : `-X ${shellWord(method)}`)

const headerLine = ({ key, value }) => (value === '' ? `${key};` : `${key}: ${value}`)

const assignment = ({ key, value }) => `${key}=${value}`

const BODY_FLAGS = {
  [CURL_RAW]: (body) => [`--data-raw ${shellQuote(body.text)}`],
  [CURL_FORM]: (body) => body.fields.map((field) => `--data-urlencode ${shellQuote(assignment(field))}`),
  [CURL_MULTIPART]: (body) => body.fields.map((field) => `-F ${shellQuote(assignment(field))}`),
  [CURL_FILE]: (body) => [`--data-binary ${shellQuote(`@${body.fileName}`)}`],
}

export function curlCommand({ method, url, user, headers, body }) {
  return [
    `curl ${methodFlag(method)} ${shellQuote(url)}`,
    ...(user ? [`-u ${shellQuote(user)}`] : []),
    ...headers.map((header) => `-H ${shellQuote(headerLine(header))}`),
    ...(body ? BODY_FLAGS[body.kind](body) : []),
  ].join(LINE_BREAK)
}
