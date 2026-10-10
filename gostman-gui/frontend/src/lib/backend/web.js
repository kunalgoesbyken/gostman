import { base64ToBytes } from '../base64'
import { openBrowserSocket, unsentBrowserHeaders } from './browserSocket'
import { mockFolders, mockRequests } from '../mockData'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

const PROXY_URL = '/api/proxy'
const DATA_KEY = 'gostman-data'
const LEGACY_KEYS = {
  requests: 'gostman_requests',
  folders: 'gostman_folders',
  history: 'gostman_history',
  variables: 'gostman_vars',
}

const inFlight = new Map()

const sampleData = () => ({ requests: [...mockRequests], folders: [...mockFolders], history: [] })

function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

function readLegacyData() {
  const stored = Object.entries(LEGACY_KEYS)
    .map(([field, key]) => [field, readStored(key)])
    .filter(([, value]) => value !== null)
  return stored.length > 0 ? Object.fromEntries(stored) : null
}

function writeData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

function migrateLegacyData(legacy) {
  writeData(legacy)
  Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key))
  return legacy
}

function mutateData(mutate) {
  const data = readStored(DATA_KEY) || sampleData()
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

async function send(id, request, variables) {
  const controller = new AbortController()
  inFlight.set(id, controller)
  try {
    return await postJSON(PROXY_URL, toEngineRequest(request, variables), controller.signal)
  } catch (error) {
    if (controller.signal.aborted) return failureResponse('cancelled', 'the request was cancelled')
    return failureResponse('network', error.message)
  } finally {
    inFlight.delete(id)
  }
}

async function load() {
  const stored = readStored(DATA_KEY)
  if (stored) return stored
  const legacy = readLegacyData()
  return legacy ? migrateLegacyData(legacy) : sampleData()
}

async function saveRequest(request) {
  const saved = { ...request, id: request.id || crypto.randomUUID() }
  mutateData((data) => {
    const others = (data.requests || []).filter((existing) => existing.id !== saved.id)
    data.requests = [...others, saved]
  })
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

async function reset() {
  localStorage.removeItem(DATA_KEY)
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
  load,
  saveRequest,
  deleteRequest,
  saveFolders,
  saveHistory,
  saveEnvironments,
  reset,
  saveFile,
  openSocket: openBrowserSocket,
  unsentSocketHeaders: unsentBrowserHeaders,
}
