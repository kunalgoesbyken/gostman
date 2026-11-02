import { timelineHops } from './timeline'

export const HAR_FILE_NAME = 'gostman-history.har'
export const HAR_MEDIA_TYPE = 'application/json'

const HAR_VERSION = '1.2'
const HAR_CREATOR = 'Gostman'
const HTTP_VERSION = 'HTTP/1.1'
const UNKNOWN_SIZE = -1
const MASK = '***'
const MASKED_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'set-cookie'])
const ENCODING_BASE64 = 'base64'

const isMasked = ({ key, masked }) => masked || MASKED_HEADERS.has(key.toLowerCase())

const pairsOf = (headers) => headers.map((header) => ({ name: header.key, value: isMasked(header) ? MASK : header.value }))

const queryOf = (address) => [...new URL(address).searchParams].map(([name, value]) => ({ name, value }))

const sentHop = (response) => (response.timeline ? timelineHops(response.timeline).at(-1) : undefined)

const requestOf = (response, hop) => ({
  method: hop?.method ?? 'GET',
  url: response.url,
  httpVersion: HTTP_VERSION,
  cookies: [],
  headers: pairsOf(hop?.sent ?? []),
  queryString: queryOf(response.url),
  headersSize: UNKNOWN_SIZE,
  bodySize: hop?.requestBytes ?? UNKNOWN_SIZE,
})

const contentOf = (response) => ({
  size: response.size,
  mimeType: response.contentType,
  text: response.body,
  ...(response.bodyEncoding === ENCODING_BASE64 && { encoding: ENCODING_BASE64 }),
})

const responseOf = (response) => ({
  status: response.statusCode,
  statusText: response.status,
  httpVersion: HTTP_VERSION,
  cookies: [],
  headers: pairsOf(response.headers),
  content: contentOf(response),
  redirectURL: '',
  headersSize: UNKNOWN_SIZE,
  bodySize: response.size,
})

const entryOf = ({ at, response }) => ({
  startedDateTime: new Date(at).toISOString(),
  time: response.durationMs,
  request: requestOf(response, sentHop(response)),
  response: responseOf(response),
  cache: {},
  timings: { send: 0, wait: response.durationMs, receive: 0 },
})

const isExportable = ({ response }) => !response.error && Boolean(response.url)

export const historyToHar = (history, version) => ({
  log: {
    version: HAR_VERSION,
    creator: { name: HAR_CREATOR, version },
    entries: history.filter(isExportable).map(entryOf),
  },
})
