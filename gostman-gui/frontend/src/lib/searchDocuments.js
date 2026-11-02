import { textBody } from './response'

export const KIND_REQUEST = 'request'
export const KIND_HISTORY = 'history'
export const KIND_RESPONSE = 'response'

const FILE_BODY_TYPES = ['binary', 'multipart']

const field = (label, text) => ({ label, text: typeof text === 'string' ? text : '' })

const bodyOf = (request) => (FILE_BODY_TYPES.includes(request.bodyType) ? '' : request.body)

const requestFields = (request) => [
  field('name', request.name),
  field('url', request.url),
  field('body', bodyOf(request)),
  field('headers', request.headers),
  field('description', request.description),
  field('tags', Array.isArray(request.tags) ? request.tags.join(' ') : ''),
]

const requestDocument = (kind, request) => ({
  key: `${kind}:${request.id}`,
  kind,
  id: request.id,
  title: request.name || request.url,
  subtitle: request.method,
  fields: requestFields(request),
})

const headerLines = (response) => (response.headers || []).map(({ key, value }) => `${key}: ${value}`).join('\n')

const responseDocument = (tab) => ({
  key: `${KIND_RESPONSE}:${tab.id}`,
  kind: KIND_RESPONSE,
  id: tab.id,
  title: tab.request.name || tab.request.url || tab.response.url,
  subtitle: tab.response.status,
  fields: [field('responseBody', textBody(tab.response)), field('responseHeaders', headerLines(tab.response))],
})

const hasResponse = (tab) => Boolean(tab.response) && !tab.response.error

export function buildDocuments({ requests, history, tabs }) {
  return [
    ...requests.map((request) => requestDocument(KIND_REQUEST, request)),
    ...history.map((entry) => requestDocument(KIND_HISTORY, entry)),
    ...tabs.filter(hasResponse).map(responseDocument),
  ]
}
