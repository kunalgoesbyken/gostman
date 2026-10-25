import { webAi } from '../ai/webAi'
import { ATTACHMENT_TEXT } from '../attachmentText'
import { base64ToBytes } from '../base64'
import { openBrowserSocket, unsentBrowserHeaders } from './browserSocket'
import { isPlainObject } from '../dataUtils'
import { browserFontLister } from '../fonts'
import { OAUTH_CALLBACK_PATH, cancelOAuthPopup, signInWithPopup } from './oauthPopup'
import { STREAM_CAP_SECONDS, readStream } from './webStream'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toMcpCall, toMcpTarget } from '../mcp'
import { withPreferredTimeout } from '../preferences'
import { compactRequest, toEngineRequest } from '../request'
import { failureResponse } from '../response'
import { DATA_TEXT } from '../dataText'
import { PRIVACY_TEXT } from '../privacyText'
import { RelayUnreachableError, currentRelay } from '../relay'
import { createStorageGate } from './storageGate'
import { TAB_DRAFTS_KEY, isStorageFull } from '../storage'
import { KIND_BEFORE_RESTORE } from '../backupKinds'
import { clearSnapshots, listSnapshots, readSnapshot, saveSnapshot, snapshotIfDue } from './webBackups'
import { webRecords } from './webRecords'

const PROXY_PATH = '/api/proxy'
const GRPC_INVOKE = 'grpc=invoke'
const MCP_INVOKE = 'mcp=invoke'
const STREAM = 'sse=1'
const EXPAND = 'expand=1'
const OPENAPI_PAGE_SIZE = 200
const HTTP_PAYLOAD_TOO_LARGE = 413
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
const storageGate = createStorageGate()
const records = webRecords(storage, [DATA_KEY, TAB_DRAFTS_KEY])
const dataChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(DATA_KEY) : null
let damageNotice = ''
let cachedDocument = null
let pendingChange = Promise.resolve()

const forgetDocument = () => {
  cachedDocument = null
}

window.addEventListener('storage', (event) => {
  if (event.key === DATA_KEY || event.key === null) forgetDocument()
})
dataChannel?.addEventListener('message', forgetDocument)

function serially(change) {
  const result = pendingChange.then(change)
  pendingChange = result.catch(() => {})
  return result
}

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

const readText = async (key) => (await records()).read(key)

async function writeText(key, text) {
  try {
    await (await records()).write(key, text)
  } catch (error) {
    throw isStorageFull(error) ? new Error(DATA_TEXT.browserStorageFull(error.room)) : error
  }
}

async function writeDocumentText(text) {
  await writeText(DATA_KEY, text)
  dataChannel?.postMessage(DATA_KEY)
}

const writeData = (data) => writeDocumentText(JSON.stringify(data))

async function migrateLegacyData(legacy) {
  await writeData(legacy)
  Object.keys(legacy).forEach((field) => storage.removeItem(LEGACY_KEYS[field]))
  return legacy
}

async function setAsideDamagedData(raw) {
  const backupKey = `${DAMAGED_DATA_PREFIX}${Date.now()}`
  await writeText(backupKey, raw)
  const fresh = emptyData()
  await writeData(fresh)
  damageNotice = DATA_TEXT.damagedDataKept(backupKey, (await records()).inDatabase)
  return fresh
}

async function readDocument() {
  const raw = await readText(DATA_KEY)
  if (raw === null) return emptyData()
  const stored = parseDocument(raw)
  if (!stored) throw new Error(UNREADABLE_DATA)
  return stored
}

const mutateData = (mutate) => serially(async () => {
  const data = cachedDocument || await readDocument()
  mutate(data)
  try {
    await writeData(data)
    cachedDocument = data
  } catch (error) {
    cachedDocument = null
    throw error
  }
})

function proxyUrl(query) {
  const relay = currentRelay()
  if (relay.isLocal && !relay.origin) throw new Error(PRIVACY_TEXT.relayMissing)
  return `${relay.origin}${PROXY_PATH}${query ? `?${query}` : ''}`
}

async function reach(url, init) {
  try {
    return await fetch(url, init)
  } catch (error) {
    const relay = currentRelay()
    if (relay.isLocal && !init.signal?.aborted) throw new RelayUnreachableError(relay.origin, PRIVACY_TEXT.relayUnreachable(relay.origin))
    throw error
  }
}

async function postJSON(query, payload, signal) {
  const response = await reach(proxyUrl(query), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  const contentType = response.headers.get('content-type') || ''
  if (response.status === HTTP_PAYLOAD_TOO_LARGE) throw new Error(ATTACHMENT_TEXT.proxyTooLarge)
  if (!response.ok || !contentType.includes('application/json')) {
    throw new Error(`The proxy answered with HTTP ${response.status} instead of a result`)
  }
  return response.json()
}

async function postForResult(query, payload, field) {
  const result = await postJSON(query, payload)
  if (result.error) throw new Error(result.error)
  return result[field]
}

async function exchange(query, id, payload) {
  const controller = new AbortController()
  inFlight.set(id, controller)
  try {
    return await postJSON(query, payload, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) return failureResponse('cancelled', 'the request was cancelled')
    return failureResponse('network', error.message)
  } finally {
    inFlight.delete(id)
  }
}

const send = (id, request, variables, cookies) => exchange('', id, toEngineRequest(withPreferredTimeout(request), variables, cookies))

const invokeGrpc = (id, request, variables) => exchange(GRPC_INVOKE, id, toGrpcCall(request, variables))

const invokeMcp = (id, request, variables) => exchange(MCP_INVOKE, id, toMcpCall(request, variables))

async function openStream(id, request, onMessages) {
  const controller = new AbortController()
  inFlight.set(id, controller)
  try {
    return await readStream(proxyUrl(STREAM), request, onMessages, controller.signal)
  } catch (error) {
    return failureResponse('network', error.message)
  } finally {
    inFlight.delete(id)
  }
}

async function readStoredData() {
  const raw = await readText(DATA_KEY)
  if (raw === null) {
    const legacy = readLegacyData()
    return legacy ? migrateLegacyData(legacy) : emptyData()
  }
  const stored = parseDocument(raw)
  if (!stored) return setAsideDamagedData(raw)
  snapshotIfDue(raw).catch(() => {})
  cachedDocument = stored
  return stored
}

async function load() {
  await storageGate.settled()
  const data = await serially(readStoredData)
  return { ...data, notice: damageNotice }
}

async function replaceDocument(text) {
  const current = await readText(DATA_KEY)
  if (current !== null) await saveSnapshot(KIND_BEFORE_RESTORE, current)
  cachedDocument = null
  await writeDocumentText(text)
}

async function restoreSnapshot(id) {
  const snapshot = await readSnapshot(id)
  if (!snapshot || !parseDocument(snapshot.data)) throw new Error(DATA_TEXT.backupUnreadable)
  await serially(() => replaceDocument(snapshot.data))
}

const backups = {
  list: listSnapshots,
  restore: (id) => storageGate.during(() => restoreSnapshot(id)),
  openFolder: null,
  remindsExport: true,
}

async function saveRequests(requests) {
  const saved = requests.map((request) => ({ ...request, id: request.id || crypto.randomUUID() }))
  const byId = new Map(saved.map((request) => [request.id, request]))
  await mutateData((data) => {
    const existing = data.requests || []
    const known = new Set(existing.map((request) => request.id))
    const updated = existing.map((request) => byId.get(request.id) ?? request)
    data.requests = [...updated, ...saved.filter((request) => !known.has(request.id))].map(compactRequest)
  })
  return saved
}

async function saveRequest(request) {
  const [saved] = await saveRequests([request])
  return saved
}

async function deleteRequests(ids) {
  const removed = new Set(ids)
  await mutateData((data) => {
    data.requests = (data.requests || []).filter((request) => !removed.has(request.id))
  })
}

async function saveFolders(folders) {
  await mutateData((data) => { data.folders = folders })
}

async function saveFlows(flows) {
  await mutateData((data) => { data.flows = flows })
}

async function saveHistory(history) {
  await mutateData((data) => { data.history = history.map(compactRequest) })
}

async function saveEnvironments(environments, activeEnvironmentId) {
  await mutateData((data) => {
    delete data.variables
    data.environments = environments
    data.activeEnvironmentId = activeEnvironmentId
  })
}

async function saveScopes(globals, activeGlobalId, collectionVariables, collectionVariablesMeta) {
  await mutateData((data) => {
    data.globals = globals
    data.activeGlobalId = activeGlobalId
    data.collectionVariables = collectionVariables
    data.collectionVariablesMeta = collectionVariablesMeta
  })
}

async function saveCollectionSettings(settings) {
  await mutateData((data) => { data.collectionSettings = settings })
}

async function shareOrder() {
  await mutateData((data) => { data.sharedOrder = true })
}

async function saveCookies(cookies) {
  await mutateData((data) => { data.cookies = cookies })
}

async function authorize(config, variables) {
  const started = await postForResult('oauth=start', { config, variables }, 'authorization')
  const { code, issuer } = await signInWithPopup(started.url, started.state, started.issuer)
  return { code, issuer, codeVerifier: started.codeVerifier, redirectUri: started.redirectUri }
}

const isStoredData = (key) => key === DATA_KEY || key === TAB_DRAFTS_KEY || key.startsWith(DAMAGED_DATA_PREFIX)

async function clearStoredData() {
  cachedDocument = null
  const target = await records()
  const keys = await target.keys()
  await Promise.all(keys.filter(isStoredData).map((key) => target.remove(key)))
  Object.keys(storage).filter(isStoredData).forEach((key) => storage.removeItem(key))
  return target
}

async function reset() {
  const target = await serially(clearStoredData)
  await clearSnapshots().catch((error) => {
    if (target.inDatabase) throw error
  })
}

const tabDrafts = {
  read: readText,
  write: (key, text) => records().then((target) => target.write(key, text)),
  remove: (key) => records().then((target) => target.remove(key)),
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
  expand: (texts, variables) => postForResult(EXPAND, { texts, variables }, 'texts'),
  parseCurl: (command) => postForResult('curl=1', { command }, 'request'),
  openapi: (query) => postJSON('openapi=1', query),
  lint: (query) => postJSON('lint=1', query),
  openapiPageSize: OPENAPI_PAGE_SIZE,
  importer: (query) => postJSON('import=1', query),
  scan: (query) => postJSON('scan=1', query),
  fetchLink: (address) => postJSON('link=1', { url: address }),
  describeGrpc: (request, variables) => postForResult('grpc=describe', toGrpcTarget(request, variables), 'schema'),
  invokeGrpc,
  describeMcp: (request, variables) => postForResult('mcp=describe', toMcpTarget(request, variables), 'catalog'),
  discoverMcpAuthorization: (query) => postJSON('mcp=auth', { ...query, native: false }),
  runsLocalCommands: false,
  invokeMcp,
  openStream,
  streamCapSeconds: STREAM_CAP_SECONDS,
  load,
  saveRequest,
  saveRequests,
  deleteRequests,
  saveFolders,
  saveFlows,
  saveHistory,
  saveEnvironments,
  saveScopes,
  saveCollectionSettings,
  shareOrder,
  saveCookies,
  tabDrafts,
  network: null,
  ai: webAi,
  mock: null,
  secrets: null,
  capture: null,
  loadTest: null,
  storage: null,
  backups,
  relay: { check: () => postForResult(EXPAND, { texts: [], variables: '{}' }, 'texts') },
  updates: null,
  oauthCallback: { url: `${window.location.origin}${OAUTH_CALLBACK_PATH}`, isFixed: true },
  authorize,
  cancelAuthorization: cancelOAuthPopup,
  fetchToken: (exchange) => postJSON('oauth=token', exchange),
  startDeviceAuthorization: (exchange) => postJSON('oauth=device', exchange),
  discoverIssuer: (query) => postJSON('oauth=discover', query),
  reset,
  saveFile,
  listInstalledFonts: browserFontLister(),
  windowFrame: null,
  webAppUrl: window.location.origin,
  openSocket: openBrowserSocket,
  unsentSocketHeaders: unsentBrowserHeaders,
}
