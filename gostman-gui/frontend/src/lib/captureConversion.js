import { BODY_BINARY, BODY_FORM, BODY_JSON, BODY_NONE, BODY_TEXT, BODY_XML } from './body'
import { pluralize } from './dataUtils'
import { exampleFromResponse, serializeExamples, withExample } from './examples'
import { normalizeRequest } from './request'
import { serializeRows } from './rows'

const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization']
const DERIVED_HEADERS = ['accept-encoding', 'connection', 'content-length']
const ENCODING_HEADER = 'content-encoding'
const DECODED_ENCODING = 'gzip'
const ENCODING_BASE64 = 'base64'
const FORM_TYPE = 'application/x-www-form-urlencoded'
const JSON_MARKER = 'json'
const XML_MARKER = 'xml'
const EXAMPLE_NAME = 'Captured'
const FALLBACK_FOLDER_NAME = 'Captured'
const QUERY_MARK = '?'
const FIELD_SEPARATOR = '&'
const VALUE_SEPARATOR = '='

const nameOf = (header) => header.key.trim().toLowerCase()

const isNamed = (names) => (header) => names.includes(nameOf(header))

const isCredential = isNamed(CREDENTIAL_HEADERS)

const isDerived = isNamed(DERIVED_HEADERS)

const isDecodedEncoding = (header) => (
  nameOf(header) === ENCODING_HEADER && header.value.trim().toLowerCase() === DECODED_ENCODING
)

const isSentAgain = (header) => !isCredential(header) && !isDerived(header) && !isDecodedEncoding(header)

const toRow = ({ key, value }) => ({ key, value, enabled: true })

const withoutQuery = (path) => path.split(QUERY_MARK)[0]

const unique = (items) => [...new Set(items)]

function decodeField(text) {
  try {
    return decodeURIComponent(text.replaceAll('+', ' '))
  } catch {
    return text
  }
}

function toFormRow(field) {
  const separator = field.indexOf(VALUE_SEPARATOR)
  const key = separator === -1 ? field : field.slice(0, separator)
  const value = separator === -1 ? '' : field.slice(separator + 1)
  return toRow({ key: decodeField(key), value: decodeField(value) })
}

const formRows = (body) => body.split(FIELD_SEPARATOR).filter(Boolean).map(toFormRow)

function draftBody({ body, bodyEncoding, contentType }) {
  if (body === '') return { bodyType: BODY_NONE, body }
  if (bodyEncoding === ENCODING_BASE64) {
    return { bodyType: BODY_BINARY, body: JSON.stringify({ fileName: '', contentType, data: body }) }
  }
  if (contentType === FORM_TYPE) return { bodyType: BODY_FORM, body: serializeRows(formRows(body)) }
  if (contentType.includes(JSON_MARKER)) return { bodyType: BODY_JSON, body }
  if (contentType.includes(XML_MARKER)) return { bodyType: BODY_XML, body }
  return { bodyType: BODY_TEXT, body }
}

export const isSavable = (exchange) => !exchange.error && !exchange.upgraded

const hasWholeResponse = (exchange) => !exchange.interrupted && !exchange.response.truncated

function examplesOf(exchange) {
  if (!hasWholeResponse(exchange)) return ''
  const { headers, body, bodyEncoding, contentType } = exchange.response
  const response = {
    status: EXAMPLE_NAME,
    statusCode: exchange.status,
    headers: headers.filter((header) => !isDecodedEncoding(header)),
    body,
    bodyEncoding,
    contentType,
  }
  return serializeExamples(withExample([], exampleFromResponse(response, EXAMPLE_NAME)))
}

function toDraft(exchange, folderId) {
  const { headers, truncated } = exchange.request
  const request = normalizeRequest({
    name: `${exchange.method} ${withoutQuery(exchange.path)}`,
    method: exchange.method,
    url: exchange.url,
    headers: serializeRows(headers.filter(isSentAgain).map(toRow)),
    ...draftBody(exchange.request),
    folderId,
    examples: examplesOf(exchange),
  })
  return { request, withheld: headers.filter(isCredential).map((header) => header.key), isIncomplete: truncated }
}

const identityOf = (exchange) => [exchange.method, exchange.path, exchange.request.body].join('\n')

function withoutRepeats(exchanges) {
  const seen = new Set()
  return exchanges.filter((exchange) => {
    const identity = identityOf(exchange)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

const BODY_NOTE = 'Bodies are saved as they were captured. Check them for tokens or personal data before sharing the collection.'

function describe({ unsavable, duplicates, drafts }) {
  const withheld = unique(drafts.flatMap((draft) => draft.withheld))
  const incomplete = drafts.filter((draft) => draft.isIncomplete).length
  const withoutExample = drafts.filter((draft) => draft.request.examples === '').length
  return [
    withheld.length > 0 && `Left out these request headers: ${withheld.join(', ')}. Add credentials as variables before sending.`,
    duplicates > 0 && `Skipped ${pluralize(duplicates, 'duplicate')} of the same method, path and body.`,
    unsavable > 0 && `Skipped ${pluralize(unsavable, 'exchange')} that failed or switched to a WebSocket.`,
    withoutExample > 0 && `Kept no example for ${pluralize(withoutExample, 'response')} that arrived incomplete.`,
    incomplete > 0 && `${pluralize(incomplete, 'request')} had a body larger than 2 MB, which is saved incomplete.`,
    drafts.length > 0 && BODY_NOTE,
  ].filter(Boolean)
}

export function draftRequests(exchanges, folderId = '') {
  const savable = exchanges.filter(isSavable)
  const distinct = withoutRepeats(savable)
  const drafts = distinct.map((exchange) => toDraft(exchange, folderId))
  return {
    requests: drafts.map((draft) => draft.request),
    notes: describe({ unsavable: exchanges.length - savable.length, duplicates: savable.length - distinct.length, drafts }),
  }
}

export function suggestedFolderName(exchanges) {
  try {
    return new URL(exchanges[0].url).host
  } catch {
    return FALLBACK_FOLDER_NAME
  }
}
