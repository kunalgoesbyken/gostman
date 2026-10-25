import { create } from 'zustand'
import { parseVariableMap, placeholderNames, substitutePlaceholders } from './placeholders'
import { isSentRow, parseRows } from './rows'
import { withInheritance } from './inheritance'
import { toHttpURL, toSocketURL } from './socketUrl'
import { protocolOf } from './realtime/protocols'
import { SOCKET_SESSIONS_TEXT as TEXT } from './socketSessionsText'
import { UNRESOLVED_TEXT } from './unresolvedText'
import { selectActiveVariables, useAppStore } from '../store/appStore'

export { isSocketAddress } from './socketUrl'

export const SOCKET_IDLE = 'idle'
export const SOCKET_CONNECTING = 'connecting'
export const SOCKET_OPEN = 'open'
export const SOCKET_WAITING = 'waiting'

export const ENTRY_SENT = 'sent'
export const ENTRY_RECEIVED = 'received'
export const ENTRY_INFO = 'info'
export const ENTRY_ERROR = 'error'
export const ENTRY_WARNING = 'warning'

export const LOG_LIMIT = 1000
export const SOCKET_PANEL = 'websocket'

const TEXT_LIMIT = 10_000
const BINARY_PREVIEW_BYTES = 64
const FLUSH_DELAY_MS = 50
const RECONNECT_DELAY_MS = 3000
const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff
const SUBPROTOCOL_HEADER = 'Sec-WebSocket-Protocol'
const DYNAMIC_PREFIX = '$'

const IDLE_SESSION = { status: SOCKET_IDLE, entries: [], dropped: 0, autoReconnect: false, draft: '', draftTarget: '', filter: '' }

export const useSocketStore = create(() => ({ sessions: {} }))

export const selectSession = (tabId) => (state) => state.sessions[tabId] || IDLE_SESSION

const links = new Map()
const retryTimers = new Map()
const queuedEntries = new Map()
const outgoing = new Map()
let flushTimer = null
let entrySequence = 0

const messageOf = (error) => error?.message || String(error)
const sessionOf = (tabId) => selectSession(tabId)(useSocketStore.getState())

function patchSession(tabId, update) {
  useSocketStore.setState((state) => {
    const session = state.sessions[tabId] || IDLE_SESSION
    return { sessions: { ...state.sessions, [tabId]: { ...session, ...update(session) } } }
  })
}

const setStatus = (tabId, status) => patchSession(tabId, () => ({ status }))

function appendEntries(session, added) {
  const entries = [...session.entries, ...added]
  const overflow = Math.max(0, entries.length - LOG_LIMIT)
  return { entries: entries.slice(overflow), dropped: session.dropped + overflow }
}

function flushEntries() {
  flushTimer = null
  for (const [tabId, added] of queuedEntries) {
    patchSession(tabId, (session) => appendEntries(session, added))
  }
  queuedEntries.clear()
}

function log(tabId, entry) {
  entrySequence += 1
  const queued = queuedEntries.get(tabId) || []
  queued.push({ ...entry, id: entrySequence, time: Date.now() })
  queuedEntries.set(tabId, queued)
  flushTimer ??= setTimeout(flushEntries, FLUSH_DELAY_MS)
}

function clippedText(text) {
  const lastCode = text.charCodeAt(TEXT_LIMIT - 1)
  const splitsSurrogatePair = lastCode >= HIGH_SURROGATE_START && lastCode <= HIGH_SURROGATE_END
  return text.slice(0, splitsSurrogatePair ? TEXT_LIMIT - 1 : TEXT_LIMIT)
}

function textEntry(kind, text) {
  if (text.length <= TEXT_LIMIT) return { kind, text }
  return { kind, text: clippedText(text), fullLength: text.length }
}

function binaryEntry(bytes) {
  const shown = Array.from(bytes.subarray(0, BINARY_PREVIEW_BYTES), (byte) => byte.toString(16).padStart(2, '0'))
  const preview = bytes.length > shown.length ? [...shown, '…'] : shown
  return { kind: ENTRY_RECEIVED, text: preview.join(' '), byteCount: bytes.length }
}

const unresolvedEntry = (names) => ({
  kind: ENTRY_WARNING,
  text: `${UNRESOLVED_TEXT.sentAsWritten(names.length)} ${names.map(UNRESOLVED_TEXT.placeholder).join(', ')}`,
})

const leftoverNames = (texts) => [...new Set(texts.flatMap(placeholderNames))]
  .filter((name) => !name.startsWith(DYNAMIC_PREFIX))

const frameEntry = (frame) => (frame.bytes ? binaryEntry(frame.bytes) : textEntry(ENTRY_RECEIVED, frame.text))

export function resolveSocketTarget(request, variablesJSON) {
  const variables = parseVariableMap(variablesJSON)
  if (!variables) return { error: TEXT.invalidVariables }
  const substitute = (text) => substitutePlaceholders(text, variables)
  const address = substitute(request.url)
  const unknownNames = placeholderNames(address)
  if (unknownNames.length > 0) return { error: TEXT.undefinedVariables(unknownNames) }
  const url = toSocketURL(address)
  if (!url) return { error: TEXT.invalidAddress }
  const headers = parseRows(request.headers)
    .filter(isSentRow)
    .map(({ key, value }) => [substitute(key), substitute(value)])
  return { url, headers, substitute }
}

function release(tabId) {
  clearTimeout(retryTimers.get(tabId))
  retryTimers.delete(tabId)
  const link = links.get(tabId)
  links.delete(tabId)
  link?.session?.stop?.()
  link?.transport?.close()
}

function dispose(tabId) {
  release(tabId)
  queuedEntries.delete(tabId)
  outgoing.delete(tabId)
  useSocketStore.setState((state) => {
    const { [tabId]: removed, ...sessions } = state.sessions
    return { sessions }
  })
}

useAppStore.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return
  const openTabIds = new Set(state.tabs.map((tab) => tab.id))
  Object.keys(useSocketStore.getState().sessions)
    .filter((tabId) => !openTabIds.has(tabId))
    .forEach(dispose)
})

function warnUnresolved(tabId, names) {
  if (names.length > 0) log(tabId, unresolvedEntry(names))
}

function unresolvedInSent(setup, unsentHeaderNames) {
  const unsent = new Set(unsentHeaderNames)
  const sentTexts = setup.headers.filter(([name]) => !unsent.has(name)).flat()
  const sentNames = new Set([setup.url, ...sentTexts].flatMap(placeholderNames))
  return (setup.context.prepared.unresolved || []).filter((name) => sentNames.has(name))
}

export function createSocketActions(backend) {
  function handleLoss(tabId, entry) {
    links.delete(tabId)
    log(tabId, entry)
    if (!sessionOf(tabId).autoReconnect) {
      setStatus(tabId, SOCKET_IDLE)
      return
    }
    setStatus(tabId, SOCKET_WAITING)
    log(tabId, { kind: ENTRY_INFO, text: TEXT.reconnecting(RECONNECT_DELAY_MS / 1000) })
    retryTimers.set(tabId, setTimeout(() => connect(tabId), RECONNECT_DELAY_MS))
  }

  function createChannel(tabId, link, isCurrent) {
    const failed = (error) => {
      if (isCurrent()) log(tabId, { kind: ENTRY_ERROR, text: TEXT.couldNotSend(messageOf(error)) })
    }
    const deliver = (write) => {
      link.ready.then(write).catch(failed)
    }
    return {
      sendText: (text) => deliver(() => link.transport.send(text)),
      sendBytes: (bytes) => deliver(() => link.transport.sendBytes(bytes)),
      frame: (frame) => log(tabId, frameEntry(frame)),
      received: (text, label) => log(tabId, { ...textEntry(ENTRY_RECEIVED, text), label }),
      info: (text) => log(tabId, { kind: ENTRY_INFO, text }),
      error: (text) => log(tabId, { kind: ENTRY_ERROR, text }),
    }
  }

  async function prepareSession(request, target) {
    const state = useAppStore.getState()
    const effective = withInheritance(state, { ...request, url: toHttpURL(target.url) })
    const prepared = await backend.prepare(effective, selectActiveVariables(state))
    const preparedHeaders = prepared.headers || []
    const protocol = protocolOf(request)
    const headers = preparedHeaders.map(({ key, value }) => [key, value])
    return {
      protocol,
      url: protocol.address ? protocol.address(target.url, request, target.substitute) : target.url,
      headers: protocol.subprotocol ? [...headers, [SUBPROTOCOL_HEADER, protocol.subprotocol]] : headers,
      context: { url: target.url, request: effective, prepared: { ...prepared, headers: preparedHeaders }, substitute: target.substitute },
    }
  }

  async function dial(tabId, target, request) {
    const link = {}
    let markReady
    link.ready = new Promise((resolve) => {
      markReady = resolve
    })
    const isCurrent = () => links.get(tabId) === link
    const whileCurrent = (handle) => (...args) => {
      if (isCurrent()) handle(...args)
    }
    const handlers = {
      onOpen: whileCurrent(() => {
        setStatus(tabId, SOCKET_OPEN)
        log(tabId, { kind: ENTRY_INFO, text: TEXT.connected })
        link.session.onOpen?.()
      }),
      onMessage: whileCurrent((frame) => link.session.onFrame(frame)),
      onError: whileCurrent((detail) => log(tabId, { kind: ENTRY_ERROR, text: detail })),
      onClose: whileCurrent((detail) => {
        link.session.stop?.()
        handleLoss(tabId, { kind: ENTRY_INFO, text: detail })
      }),
    }
    links.set(tabId, link)
    try {
      const setup = await prepareSession(request, target)
      warnUnresolved(tabId, unresolvedInSent(setup, backend.unsentSocketHeaders(setup.headers)))
      link.session = setup.protocol.createSession(createChannel(tabId, link, isCurrent), setup.context)
      const transport = await backend.openSocket(setup.url, setup.headers, handlers)
      if (!isCurrent()) {
        transport.close()
        return
      }
      link.transport = transport
      markReady()
    } catch (error) {
      if (isCurrent()) handleLoss(tabId, { kind: ENTRY_ERROR, text: TEXT.couldNotConnect(messageOf(error)) })
    }
  }

  async function connect(tabId) {
    const state = useAppStore.getState()
    const tab = state.tabs.find((candidate) => candidate.id === tabId)
    if (!tab) return
    release(tabId)
    const target = resolveSocketTarget(tab.request, selectActiveVariables(state))
    if (target.error) {
      setStatus(tabId, SOCKET_IDLE)
      log(tabId, { kind: ENTRY_ERROR, text: target.error })
      return
    }
    setStatus(tabId, SOCKET_CONNECTING)
    log(tabId, { kind: ENTRY_INFO, text: TEXT.connecting(target.url) })
    await dial(tabId, target, tab.request)
  }

  function disconnect(tabId) {
    const wasActive = sessionOf(tabId).status !== SOCKET_IDLE
    release(tabId)
    setStatus(tabId, SOCKET_IDLE)
    if (wasActive) log(tabId, { kind: ENTRY_INFO, text: TEXT.disconnected })
  }

  function openSession(tabId) {
    const session = links.get(tabId)?.session
    return session && sessionOf(tabId).status === SOCKET_OPEN ? session : null
  }

  function withOpenSession(tabId, use) {
    const session = openSession(tabId)
    if (!session) return
    try {
      use(session)
    } catch (error) {
      log(tabId, { kind: ENTRY_ERROR, text: messageOf(error) })
    }
  }

  async function filledTexts(texts) {
    if (!texts.some((text) => placeholderNames(text).length > 0)) return texts
    return backend.expand(texts, selectActiveVariables(useAppStore.getState()))
  }

  async function deliver(tabId, message) {
    try {
      const [body, target] = await filledTexts([message.body, message.target])
      const session = openSession(tabId)
      if (!session) throw new Error(TEXT.notConnected)
      const sent = session.compose({ body, target })
      log(tabId, { ...textEntry(ENTRY_SENT, sent.text), label: sent.label })
      warnUnresolved(tabId, leftoverNames([body, target]))
    } catch (error) {
      log(tabId, { kind: ENTRY_ERROR, text: messageOf(error) })
      patchSession(tabId, (session) => (session.draft === '' ? { draft: message.body } : {}))
    }
  }

  function sendMessage(tabId) {
    const { draft, draftTarget } = sessionOf(tabId)
    if (draft === '' && draftTarget.trim() === '') return
    if (!openSession(tabId)) return
    patchSession(tabId, () => ({ draft: '' }))
    const previous = outgoing.get(tabId) || Promise.resolve()
    outgoing.set(tabId, previous.then(() => deliver(tabId, { body: draft, target: draftTarget })))
  }

  const subscribe = (tabId) => withOpenSession(tabId, (session) => session.subscribe(sessionOf(tabId).filter))

  function clearLog(tabId) {
    queuedEntries.delete(tabId)
    patchSession(tabId, () => ({ entries: [], dropped: 0 }))
  }

  function setAutoReconnect(tabId, autoReconnect) {
    patchSession(tabId, () => ({ autoReconnect }))
    if (!autoReconnect && sessionOf(tabId).status === SOCKET_WAITING) disconnect(tabId)
  }

  function openFromAddressBar(tabId) {
    useAppStore.getState().setRequestPanel(SOCKET_PANEL)
    if (sessionOf(tabId).status === SOCKET_IDLE) connect(tabId)
  }

  return {
    connect,
    disconnect,
    sendMessage,
    clearLog,
    openFromAddressBar,
    subscribe,
    setDraft: (tabId, draft) => patchSession(tabId, () => ({ draft })),
    setDraftTarget: (tabId, draftTarget) => patchSession(tabId, () => ({ draftTarget })),
    setFilter: (tabId, filter) => patchSession(tabId, () => ({ filter })),
    loadMessage: (tabId, message) => patchSession(tabId, () => ({ draft: message.body, draftTarget: message.target })),
    setAutoReconnect,
    unsentHeaders: backend.unsentSocketHeaders,
  }
}
