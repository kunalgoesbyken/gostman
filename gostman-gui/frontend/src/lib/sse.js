import { parseRows, isSentRow } from './rows'

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

const END_TEXT = {
  closed: 'The server closed the stream.',
  cancelled: 'The stream was stopped.',
  maxEvents: 'Stopped at the event limit. Raise it under Settings.',
  maxBytes: 'Stopped at the size limit.',
  maxDuration: 'Stopped at the time limit. Raise it under Settings.',
  failed: 'The stream failed.',
}

const hostedLimitText = (seconds) => `Stopped at the time limit. The web app streams for at most ${seconds} seconds; the desktop app can stream longer.`

export const SSE_SETTINGS_TEXT = {
  stream: 'Stream as server-sent events',
  reconnect: 'Reconnect when the server closes the stream',
  maxEvents: 'Max events',
  maxEventsPlaceholder: 'Default 10000',
  maxSeconds: 'Max seconds',
  maxSecondsPlaceholder: 'Default 300',
}

export const SSE_TEXT = {
  allTypes: 'All event types',
  searchLabel: 'Search events',
  searchPlaceholder: 'Search events',
  pause: 'Pause autoscroll',
  resume: 'Resume autoscroll',
  clear: 'Clear events',
  copyAll: 'Copy shown events',
  copied: 'Copied',
  copyEvent: 'Copy event data',
  noEvents: 'No events yet',
  waiting: 'Waiting for the server to send an event.',
  noMatches: 'No events match',
  noMatchesHint: 'Change the type filter or the search to see more.',
  clipped: 'This event was too long, so the rest was left out.',
  shown: (shown, total) => `${shown} of ${total} shown`,
  received: (count) => `${count} received`,
  dropped: (count) => `The ${count} oldest events are no longer listed. The downloaded response still has every event.`,
  reconnecting: (seconds, attempt) => `Reconnecting in ${seconds} s (attempt ${attempt})`,
}

export const STATUS_TEXT = {
  [STREAM_CONNECTING]: 'Connecting',
  [STREAM_OPEN]: 'Streaming',
  [STREAM_RECONNECTING]: 'Reconnecting',
  [STREAM_ENDED]: 'Ended',
}

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

export const formatEventTime = (time) => new Date(time).toLocaleTimeString([], TIME_FORMAT)

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
  if (session.endReason === END_MAX_DURATION && session.capSeconds) return hostedLimitText(session.capSeconds)
  if (session.endReason === END_FAILED && session.endDetail) return `${END_TEXT.failed} ${session.endDetail}`
  return END_TEXT[session.endReason] || END_TEXT.closed
}
