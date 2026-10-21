import { create } from 'zustand'
import {
  MESSAGE_END, MESSAGE_EVENT, MESSAGE_OPEN, MESSAGE_WAIT,
  STREAM_CONNECTING, STREAM_ENDED, STREAM_OPEN, STREAM_RECONNECTING,
} from './sse'
import { useAppStore } from '../store/appStore'

const EVENT_LIMIT = 5000

export const useSseStore = create(() => ({ sessions: {} }))

export const selectSession = (streamId) => (state) => state.sessions[streamId]

const freshSession = (capSeconds) => ({
  status: STREAM_CONNECTING,
  events: [],
  dropped: 0,
  types: {},
  total: 0,
  capSeconds,
  attempt: 0,
  retryMs: 0,
  endReason: '',
  endDetail: '',
})

function addEvents(session, events) {
  const combined = [...session.events, ...events]
  const overflow = Math.max(0, combined.length - EVENT_LIMIT)
  const types = { ...session.types }
  events.forEach((event) => { types[event.type] = (types[event.type] || 0) + 1 })
  return {
    ...session,
    events: combined.slice(overflow),
    dropped: session.dropped + overflow,
    total: session.total + events.length,
    types,
  }
}

function reduce(session, message) {
  if (message.kind === MESSAGE_OPEN) return { ...session, status: STREAM_OPEN, retryMs: 0 }
  if (message.kind === MESSAGE_WAIT) return { ...session, status: STREAM_RECONNECTING, retryMs: message.retryMs, attempt: message.attempt }
  if (message.kind === MESSAGE_END) return { ...session, status: STREAM_ENDED, endReason: message.reason, endDetail: message.detail || '' }
  return session
}

function patch(streamId, update) {
  useSseStore.setState((state) => {
    const session = state.sessions[streamId]
    return session ? { sessions: { ...state.sessions, [streamId]: update(session) } } : state
  })
}

export function beginSession(streamId, capSeconds) {
  useSseStore.setState((state) => ({ sessions: { ...state.sessions, [streamId]: freshSession(capSeconds) } }))
}

export function applyMessages(streamId, messages) {
  const events = messages.filter((message) => message.kind === MESSAGE_EVENT).map((message) => message.event)
  patch(streamId, (session) => {
    const withEvents = events.length > 0 ? addEvents(session, events) : session
    return messages.reduce(reduce, withEvents)
  })
}

export function removeSession(streamId) {
  useSseStore.setState((state) => {
    const { [streamId]: removed, ...sessions } = state.sessions
    return { sessions }
  })
}

export const clearEvents = (streamId) => patch(streamId, (session) => ({ ...session, events: [], dropped: 0, types: {}, total: 0 }))

useAppStore.subscribe((state, previous) => {
  if (state.tabs === previous.tabs) return
  const streamIds = Object.keys(useSseStore.getState().sessions)
  if (streamIds.length === 0) return
  const referenced = new Set(state.tabs.flatMap((tab) => [tab.pendingId, tab.response?.streamId]))
  streamIds.filter((streamId) => !referenced.has(streamId)).forEach(removeSession)
})
