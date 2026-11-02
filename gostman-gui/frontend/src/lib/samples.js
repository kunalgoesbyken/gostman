import { serializeExamples } from './examples'
import { FEATURE_SAMPLES_TEXT as TEXT } from './featuresText'
import { normalizeRequest } from './request'
import { normalizeFlow } from './flows/model'

export const SAMPLE_HOST = 'sample.gostman.test'
export const SAMPLE_FOLDER_ID = 'folder-sample-collection'

const SAMPLE_ORIGIN = `https://${SAMPLE_HOST}`
const SAMPLE_SCAN_REQUEST_ID = 'request-sample-fake-token'
const SAMPLE_FLOW_ID = 'flow-sample-users'
const FAKE_TOKEN = 'ghp_aB3dE5gH7jK9mN1pQ3rS5tU7vW9xY1zA3bC5'
const JSON_TYPE = 'application/json'
const CBOR_TYPE = 'application/cbor'
const CBOR_USER = 'omJpZAFkbmFtZWNBZGE='

const jsonExample = (id, name, status, body) => ({
  id,
  name,
  status,
  headers: [{ key: 'Content-Type', value: JSON_TYPE }],
  body: JSON.stringify(body, null, 2),
  bodyEncoding: 'utf8',
  contentType: JSON_TYPE,
  isDefault: true,
})

const cborExample = () => ({
  id: 'example-sample-cbor',
  name: TEXT.okExample,
  status: 200,
  headers: [{ key: 'Content-Type', value: CBOR_TYPE }],
  body: CBOR_USER,
  bodyEncoding: 'base64',
  contentType: CBOR_TYPE,
  isDefault: true,
})

const sampleRequest = (id, name, fields, order) => normalizeRequest({
  id,
  name,
  folderId: SAMPLE_FOLDER_ID,
  sortOrder: order,
  ...fields,
})

export const isSampleRequest = (request) => request.url.startsWith(`${SAMPLE_ORIGIN}/`)

export function sampleCollection() {
  const folder = { id: SAMPLE_FOLDER_ID, name: TEXT.collection, isOpen: true, parentId: '', sortOrder: 1 }
  const requests = [
    sampleRequest('request-sample-list-users', TEXT.listUsers, {
      url: `${SAMPLE_ORIGIN}/users`,
      examples: serializeExamples([jsonExample('example-sample-users', TEXT.okExample, 200, [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])]),
    }, 1),
    sampleRequest('request-sample-get-user', TEXT.getUser, {
      url: `${SAMPLE_ORIGIN}/users/1`,
      examples: serializeExamples([jsonExample('example-sample-user', TEXT.okExample, 200, { id: 1, name: 'Ada' })]),
    }, 2),
    sampleRequest('request-sample-create-user', TEXT.createUser, {
      method: 'POST',
      url: `${SAMPLE_ORIGIN}/users`,
      body: JSON.stringify({ name: 'Linus' }, null, 2),
      bodyType: 'json',
      headers: JSON.stringify([{ key: 'Content-Type', value: JSON_TYPE, enabled: true }]),
      examples: serializeExamples([jsonExample('example-sample-created', TEXT.createdExample, 201, { id: 3, name: 'Linus' })]),
    }, 3),
    sampleBinaryRequest(),
  ]
  return { folder, requests }
}

export const sampleBinaryRequest = () => sampleRequest('request-sample-binary', TEXT.binaryRequest, {
  url: `${SAMPLE_ORIGIN}/users/1.cbor`,
  examples: serializeExamples([cborExample()]),
}, 4)

export const sampleScanRequest = () => sampleRequest(SAMPLE_SCAN_REQUEST_ID, TEXT.scanRequest, {
  url: `${SAMPLE_ORIGIN}/users`,
  headers: JSON.stringify([{ key: 'Authorization', value: `Bearer ${FAKE_TOKEN}`, enabled: true }]),
}, 5)

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

const PROTOCOL_REQUESTS = {
  graphql: () => ({ name: TEXT.graphqlRequest, method: 'GRAPHQL' }),
  grpc: () => ({ name: TEXT.grpcRequest, method: 'GRPC' }),
  mcp: () => ({ name: TEXT.mcpRequest, method: 'MCP' }),
  websocket: () => ({ name: TEXT.websocketRequest, url: 'wss://' }),
  jwt: () => ({ name: TEXT.jwtRequest, auth: { type: 'jwt' } }),
}

export const protocolRequest = (kind) => normalizeRequest(PROTOCOL_REQUESTS[kind]())
