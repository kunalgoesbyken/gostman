import { formatTime } from './i18n/format'
import { parseRows, isSentRow } from './rows'
import { STREAM_END_TEXT } from './sseText'

export const SSE_PROTOCOL = 'sse'
const DEFAULT_EVENT_TYPE = 'message'

export const MESSAGE_OPEN = 'open'
export const MESSAGE_EVENT = 'event'
export const MESSAGE_WAIT = 'wait'
export const MESSAGE_END = 'end'
export const MESSAGE_RESPONSE = 'response'

export const END_CANCELLED = 'cancelled'
export const END_FAILED = 'failed'
const END_MAX_DURATION = 'maxDuration'

export const STREAM_CONNECTING = 'connecting'
export const STREAM_OPEN = 'open'
export const STREAM_RECONNECTING = 'reconnecting'
export const STREAM_ENDED = 'ended'

const EVENT_STREAM = 'text/event-stream'
const ACCEPT_HEADER = 'accept'
const JSON_OPENERS = ['{', '[']
const TIME_FORMAT = { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }

export function isStreamRequest(request) {
  if (request.options.stream) return true
  return parseRows(request.headers).some((row) => (
    isSentRow(row) && row.key.trim().toLowerCase() === ACCEPT_HEADER && row.value.toLowerCase().includes(EVENT_STREAM)
  ))
}

function readEventJson(data) {
  if (!JSON_OPENERS.includes(data.trimStart()[0])) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export const prettyEventData = (data) => {
  const parsed = readEventJson(data)
  return parsed === null ? data : JSON.stringify(parsed, null, 2)
}

export const formatEventTime = (time) => formatTime(time, TIME_FORMAT)

function eventToText(event) {
  const lines = []
  if (event.id) lines.push(`id: ${event.id}`)
  if (event.type !== DEFAULT_EVENT_TYPE) lines.push(`event: ${event.type}`)
  event.data.split('\n').forEach((line) => lines.push(`data: ${line}`))
  return `${lines.join('\n')}\n\n`
}

export const eventsToText = (events) => events.map(eventToText).join('')

export function filterEvents(events, type, query) {
  const needle = query.trim().toLocaleLowerCase()
  return events.filter((event) => {
    if (type && event.type !== type) return false
    if (needle === '') return true
    return [event.type, event.id, event.data].some((field) => field.toLocaleLowerCase().includes(needle))
  })
}

export function endSummary(session) {
  if (session.endReason === END_MAX_DURATION && session.capSeconds) return STREAM_END_TEXT.hostedLimit(session.capSeconds)
  if (session.endReason === END_FAILED && session.endDetail) return STREAM_END_TEXT.failedWith(session.endDetail)
  return STREAM_END_TEXT[session.endReason] || STREAM_END_TEXT.closed
}
