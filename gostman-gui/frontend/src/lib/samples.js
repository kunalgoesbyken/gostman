import { serializeExamples } from './examples'
import { FEATURE_SAMPLES_TEXT as TEXT } from './featuresText'
import { normalizeRequest } from './request'
import { normalizeFlow } from './flows/model'

export const SAMPLE_FOLDER_ID = 'folder-sample-collection'
const SAMPLE_SCAN_REQUEST_ID = 'request-sample-fake-token'

const FAKE_TOKEN = 'ghp_aB3dE5gH7jK9mN1pQ3rS5tU7vW9xY1zA3bC5'
const JSON_HEADERS = [{ key: 'Content-Type', value: 'application/json' }]

const savedExample = (id, name, status, body) => ({
  id,
  name,
  status,
  headers: JSON_HEADERS,
  body: JSON.stringify(body, null, 2),
  bodyEncoding: 'utf8',
  contentType: 'application/json',
  isDefault: true,
})

const sampleRequest = (id, name, fields, order) => normalizeRequest({
  id,
  name,
  folderId: SAMPLE_FOLDER_ID,
  sortOrder: order,
  ...fields,
})

export function sampleCollection() {
  const folder = {
    id: SAMPLE_FOLDER_ID,
    name: TEXT.collection,
    isOpen: true,
    parentId: '',
    sortOrder: 1,
    collectionVariables: JSON.stringify({ baseUrl: TEXT.baseUrl }),
  }
  const requests = [
    sampleRequest('request-sample-list-users', TEXT.listUsers, {
      method: 'GET',
      url: '{{baseUrl}}/users',
      examples: serializeExamples([savedExample('example-sample-users', TEXT.okExample, 200, [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])]),
    }, 1),
    sampleRequest('request-sample-get-user', TEXT.getUser, {
      method: 'GET',
      url: '{{baseUrl}}/users/1',
      examples: serializeExamples([savedExample('example-sample-user', TEXT.okExample, 200, { id: 1, name: 'Ada' })]),
    }, 2),
    sampleRequest('request-sample-create-user', TEXT.createUser, {
      method: 'POST',
      url: '{{baseUrl}}/users',
      body: JSON.stringify({ name: 'Linus' }, null, 2),
      bodyType: 'json',
      headers: JSON.stringify([{ key: 'Content-Type', value: 'application/json', enabled: true }]),
      examples: serializeExamples([savedExample('example-sample-created', TEXT.createdExample, 201, { id: 3, name: 'Linus' })]),
    }, 3),
  ]
  return { folder, requests }
}

const SAMPLE_FLOW_ID = 'flow-sample-users'

export const sampleFlow = () => normalizeFlow({
  id: SAMPLE_FLOW_ID,
  name: TEXT.flowName,
  description: TEXT.flowDescription,
  steps: [
    { id: 'list-users', kind: 'request', label: TEXT.listUsers, requestId: 'request-sample-list-users' },
    { id: 'get-user', kind: 'request', label: TEXT.getUser, requestId: 'request-sample-get-user' },
    { id: 'done', kind: 'end', label: TEXT.flowDone, outcome: 'passed' },
  ],
})

export const sampleScanRequest = () => sampleRequest(SAMPLE_SCAN_REQUEST_ID, TEXT.scanRequest, {
  method: 'GET',
  url: '{{baseUrl}}/users',
  headers: JSON.stringify([{ key: 'Authorization', value: `Bearer ${FAKE_TOKEN}`, enabled: true }]),
}, 4)

const PROTOCOL_REQUESTS = {
  graphql: () => ({ name: TEXT.graphqlRequest, method: 'GRAPHQL' }),
  grpc: () => ({ name: TEXT.grpcRequest, method: 'GRPC' }),
  mcp: () => ({ name: TEXT.mcpRequest, method: 'MCP' }),
  websocket: () => ({ name: TEXT.websocketRequest, url: 'wss://' }),
}

export const protocolRequest = (kind) => normalizeRequest(PROTOCOL_REQUESTS[kind]())
