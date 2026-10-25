const REQUEST_HEADER_NAMES = [
  'Content-Type',
  'Accept',
  'Authorization',
  'User-Agent',
  'Cache-Control',
  'Accept-Encoding',
  'Accept-Language',
  'Cookie',
  'Origin',
  'Referer',
  'Host',
  'Content-Length',
  'Connection',
  'If-None-Match',
  'If-Modified-Since',
  'X-Requested-With',
  'X-API-Key',
  'X-Request-ID',
  'X-Correlation-ID',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Forwarded-Proto',
  'X-HTTP-Method-Override',
  'Idempotency-Key',
  'Prefer',
  'Range',
  'If-Match',
  'If-Unmodified-Since',
  'If-Range',
  'Content-Encoding',
  'Content-Language',
  'Content-Disposition',
  'Accept-Charset',
  'Pragma',
  'Expect',
  'Upgrade',
  'TE',
  'DNT',
  'Forwarded',
  'Proxy-Authorization',
  'Access-Control-Request-Method',
  'Access-Control-Request-Headers',
  'Sec-Fetch-Mode',
  'Sec-Fetch-Site',
  'Sec-Fetch-Dest',
  'Upgrade-Insecure-Requests',
]

const MEDIA_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/xml',
  'text/xml',
  'text/html',
  'application/octet-stream',
  'application/graphql',
  'application/json; charset=utf-8',
  'application/problem+json',
  'application/ld+json',
  'application/merge-patch+json',
  'application/json-patch+json',
  'application/yaml',
  'application/pdf',
  'application/zip',
  'text/csv',
  'text/event-stream',
  'image/png',
  'image/jpeg',
]

const ACCEPT_VALUES = [
  'application/json',
  '*/*',
  'text/html',
  'application/xml',
  'text/plain',
  'application/json, text/plain, */*',
  'application/problem+json',
  'text/event-stream',
  'application/octet-stream',
]

const HEADER_VALUES = {
  'content-type': MEDIA_TYPES,
  accept: ACCEPT_VALUES,
  authorization: ['Bearer ', 'Basic ', 'Digest ', 'Token ', 'ApiKey '],
  'proxy-authorization': ['Basic ', 'Bearer '],
  'cache-control': ['no-cache', 'no-store', 'max-age=0', 'no-cache, no-store, must-revalidate', 'max-age=3600', 'public', 'private', 'only-if-cached'],
  'accept-encoding': ['gzip, deflate, br', 'gzip', 'br', 'deflate', 'zstd', 'identity'],
  'content-encoding': ['gzip', 'br', 'deflate', 'zstd', 'identity'],
  'accept-language': ['en-US,en;q=0.9', 'en-US', 'en', 'fr', 'de', 'es', 'ja', 'zh-CN', '*'],
  'content-language': ['en-US', 'en', 'fr', 'de', 'es'],
  'accept-charset': ['utf-8', 'iso-8859-1', '*'],
  connection: ['keep-alive', 'close', 'Upgrade'],
  pragma: ['no-cache'],
  expect: ['100-continue'],
  upgrade: ['websocket', 'h2c'],
  te: ['trailers'],
  dnt: ['1', '0'],
  prefer: ['return=minimal', 'return=representation', 'respond-async'],
  'x-requested-with': ['XMLHttpRequest'],
  'x-http-method-override': ['PUT', 'PATCH', 'DELETE'],
  'x-forwarded-proto': ['https', 'http'],
  range: ['bytes=0-'],
  'content-disposition': ['attachment', 'inline', 'form-data'],
  'sec-fetch-mode': ['cors', 'navigate', 'no-cors', 'same-origin'],
  'sec-fetch-site': ['same-origin', 'same-site', 'cross-site', 'none'],
  'sec-fetch-dest': ['empty', 'document', 'image', 'script'],
  'upgrade-insecure-requests': ['1'],
}

const lower = (text) => text.toLocaleLowerCase()

export function rankedMatches(candidates, typed) {
  const needle = lower(typed.trim())
  if (needle === '') return candidates
  const prefixed = candidates.filter((candidate) => lower(candidate).startsWith(needle))
  const contained = candidates.filter((candidate) => !prefixed.includes(candidate) && lower(candidate).includes(needle))
  const ranked = [...prefixed, ...contained]
  const isSettled = ranked.length === 1 && lower(ranked[0]) === needle
  return isSettled ? [] : ranked
}

export const suggestHeaderNames = (typed) => rankedMatches(REQUEST_HEADER_NAMES, typed)

export const suggestHeaderValues = (name, typed) => rankedMatches(HEADER_VALUES[lower(name.trim())] ?? [], typed)

export const HEADER_SUGGESTIONS = { names: suggestHeaderNames, values: suggestHeaderValues }
