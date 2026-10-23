import { webAi } from '../ai/webAi'
import { base64ToBytes } from '../base64'
import { openBrowserSocket, unsentBrowserHeaders } from './browserSocket'
import { isPlainObject } from '../dataUtils'
import { browserFontLister } from '../fonts'
import { OAUTH_CALLBACK_PATH, cancelOAuthPopup, signInWithPopup } from './oauthPopup'
import { STREAM_CAP_SECONDS, readStream } from './webStream'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toMcpCall, toMcpTarget } from '../mcp'
import { mockFolders, mockRequests } from '../mockData'
import { withPreferredTimeout } from '../preferences'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

const PROXY_URL = '/api/proxy'
const GRPC_INVOKE_URL = `${PROXY_URL}?grpc=invoke`
const MCP_INVOKE_URL = `${PROXY_URL}?mcp=invoke`
const STREAM_URL = `${PROXY_URL}?sse=1`
const OPENAPI_PAGE_SIZE = 200
const DATA_KEY = 'gostman-data'
const DAMAGED_DATA_PREFIX = 'gostman-data-damaged-'
const UNREADABLE_DATA = 'The saved data in this browser cannot be read, so nothing was changed.'
const LEGACY_KEYS = {
  requests: 'gostman_requests',
  folders: 'gostman_folders',
  history: 'gostman_history',
  variables: 'gostman_vars',
}

const inFlight = new Map()

function memoryStorage() {
  const items = new Map()
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function openStorage() {
  try {
    return window.localStorage
  } catch {
    return memoryStorage()
  }
}

const storage = openStorage()
let damageNotice = ''

const sampleData = () => ({ requests: [...mockRequests], folders: [...mockFolders], history: [] })

const emptyData = () => ({ requests: [], folders: [], history: [] })

function parseStored(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseDocument(raw) {
  const parsed = parseStored(raw)
  return isPlainObject(parsed) ? parsed : null
}

function readLegacyData() {
  const stored = Object.entries(LEGACY_KEYS)
    .map(([field, key]) => [field, parseStored(storage.getItem(key))])
    .filter(([, value]) => value !== null)
  return stored.length > 0 ? Object.fromEntries(stored) : null
}

function writeData(data) {
  storage.setItem(DATA_KEY, JSON.stringify(data))
}

function migrateLegacyData(legacy) {
  writeData(legacy)
  Object.keys(legacy).forEach((field) => storage.removeItem(LEGACY_KEYS[field]))
  return legacy
}

function setAsideDamagedData(raw) {
  const backupKey = `${DAMAGED_DATA_PREFIX}${Date.now()}`
  storage.setItem(backupKey, raw)
  const fresh = emptyData()
  writeData(fresh)
  damageNotice = `The saved data in this browser could not be read, so the app started empty. The unreadable copy was kept in this browser's local storage under "${backupKey}".`
  return fresh
}

function readDocument() {
  const raw = storage.getItem(DATA_KEY)
  if (raw === null) return sampleData()
  const stored = parseDocument(raw)
  if (!stored) throw new Error(UNREADABLE_DATA)
  return stored
}

function mutateData(mutate) {
  const data = readDocument()
  mutate(data)
  writeData(data)
}

async function postJSON(url, payload, signal) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error(`The proxy answered with HTTP ${response.status} instead of a result`)
  }
  return response.json()
}

async function postForResult(query, payload, field) {
  const result = await postJSON(`${PROXY_URL}?${query}`, payload)
  if (result.error) throw new Error(result.error)
  return result[field]
}

async function exchange(url, id, payload) {
  const controller = new AbortController()
  inFlight.set(id, controller)
  try {
    return await postJSON(url, payload, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) return failureResponse('cancelled', 'the request was cancelled')
    return failureResponse('network', error.message)
  } finally {
    inFlight.delete(id)
  }
}

const send = (id, request, variables, cookies) => exchange(PROXY_URL, id, toEngineRequest(withPreferredTimeout(request), variables, cookies))

const invokeGrpc = (id, request, variables) => exchange(GRPC_INVOKE_URL, id, toGrpcCall(request, variables))

const invokeMcp = (id, request, variables) => exchange(MCP_INVOKE_URL, id, toMcpCall(request, variables))

function openStream(id, request, onMessages) {
  const controller = new AbortController()
  inFlight.set(id, controller)
  return readStream(STREAM_URL, request, onMessages, controller.signal).finally(() => inFlight.delete(id))
}

function readStoredData() {
  const raw = storage.getItem(DATA_KEY)
  if (raw !== null) return parseDocument(raw) || setAsideDamagedData(raw)
  const legacy = readLegacyData()
  return legacy ? migrateLegacyData(legacy) : sampleData()
}

async function load() {
  const data = readStoredData()
  return { ...data, notice: damageNotice }
}

async function saveRequests(requests) {
  const saved = requests.map((request) => ({ ...request, id: request.id || crypto.randomUUID() }))
  const savedIds = new Set(saved.map((request) => request.id))
  mutateData((data) => {
    const others = (data.requests || []).filter((existing) => !savedIds.has(existing.id))
    data.requests = [...others, ...saved]
  })
  return saved
}

async function saveRequest(request) {
  const [saved] = await saveRequests([request])
  return saved
}

async function deleteRequest(id) {
  mutateData((data) => {
    data.requests = (data.requests || []).filter((request) => request.id !== id)
  })
}

async function saveFolders(folders) {
  mutateData((data) => { data.folders = folders })
}

async function saveHistory(history) {
  mutateData((data) => { data.history = history })
}

async function saveEnvironments(environments, activeEnvironmentId) {
  mutateData((data) => {
    delete data.variables
    data.environments = environments
    data.activeEnvironmentId = activeEnvironmentId
  })
}

async function saveScopes(globals, activeGlobalId, collectionVariables) {
  mutateData((data) => {
    data.globals = globals
    data.activeGlobalId = activeGlobalId
    data.collectionVariables = collectionVariables
  })
}

async function saveCollectionSettings(settings) {
  mutateData((data) => { data.collectionSettings = settings })
}

async function saveCookies(cookies) {
  mutateData((data) => { data.cookies = cookies })
}

async function authorize(config, variables) {
  const started = await postForResult('oauth=start', { config, variables }, 'authorization')
  const code = await signInWithPopup(started.url, started.state)
  return { code, codeVerifier: started.codeVerifier, redirectUri: started.redirectUri }
}

async function reset() {
  storage.removeItem(DATA_KEY)
}

async function saveFile(name, base64, mime) {
  const url = URL.createObjectURL(new Blob([base64ToBytes(base64)], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export const webBackend = {
  send,
  cancel: (id) => inFlight.get(id)?.abort(),
  prepare: (request, variables) => postForResult('prepare=1', toEngineRequest(request, variables), 'prepared'),
  parseCurl: (command) => postForResult('curl=1', { command }, 'request'),
  openapi: (query) => postJSON(`${PROXY_URL}?openapi=1`, query),
  lint: (query) => postJSON(`${PROXY_URL}?lint=1`, query),
  openapiPageSize: OPENAPI_PAGE_SIZE,
  importer: (query) => postJSON(`${PROXY_URL}?import=1`, query),
  scan: (query) => postJSON(`${PROXY_URL}?scan=1`, query),
  fetchLink: (address) => postJSON(`${PROXY_URL}?link=1`, { url: address }),
  describeGrpc: (request, variables) => postForResult('grpc=describe', toGrpcTarget(request, variables), 'schema'),
  invokeGrpc,
  describeMcp: (request, variables) => postForResult('mcp=describe', toMcpTarget(request, variables), 'catalog'),
  runsLocalCommands: false,
  invokeMcp,
  openStream,
  streamCapSeconds: STREAM_CAP_SECONDS,
  load,
  saveRequest,
  saveRequests,
  deleteRequest,
  saveFolders,
  saveHistory,
  saveEnvironments,
  saveScopes,
  saveCollectionSettings,
  saveCookies,
  network: null,
  ai: webAi,
  mock: null,
  secrets: null,
  capture: null,
  loadTest: null,
  storage: null,
  oauthCallback: { url: `${window.location.origin}${OAUTH_CALLBACK_PATH}`, isFixed: true },
  authorize,
  cancelAuthorization: cancelOAuthPopup,
  fetchToken: (exchange) => postJSON(`${PROXY_URL}?oauth=token`, exchange),
  reset,
  saveFile,
  listInstalledFonts: browserFontLister(),
  webAppUrl: window.location.origin,
  openSocket: openBrowserSocket,
  unsentSocketHeaders: unsentBrowserHeaders,
}
