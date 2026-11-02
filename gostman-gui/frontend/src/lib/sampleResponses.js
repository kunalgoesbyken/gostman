import { exampleSize, parseExamples, servedByDefault } from './examples'

const NOT_FOUND = { name: '404 Not Found', status: 404, headers: [], body: '', bodyEncoding: 'utf8', contentType: '' }

export async function sampleTransport(sendId, request) {
  const example = servedByDefault(parseExamples(request.examples)) ?? NOT_FOUND
  return {
    status: example.name,
    statusCode: example.status,
    headers: example.headers,
    cookies: [],
    body: example.body,
    bodyEncoding: example.bodyEncoding,
    contentType: example.contentType,
    size: exampleSize(example),
    durationMs: 0,
    url: request.url,
    truncated: false,
    error: '',
  }
}
