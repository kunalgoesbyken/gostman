import { WSClose, WSConnect, WSSend } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const MESSAGE_EVENT = 'ws:message'
const STATE_EVENT = 'ws:state'
const STATE_ERROR = 'error'
const STATE_CLOSED = 'closed'

const receivers = new Map()
const dialBuffers = new Set()
let isSubscribed = false

function route(eventName, event) {
  const receive = receivers.get(event?.connectionId)
  if (receive) {
    receive(eventName, event)
    return
  }
  dialBuffers.forEach((buffer) => buffer.push([eventName, event]))
}

function subscribe() {
  if (isSubscribed) return
  isSubscribed = true
  EventsOn(MESSAGE_EVENT, (event) => route(MESSAGE_EVENT, event))
  EventsOn(STATE_EVENT, (event) => route(STATE_EVENT, event))
}

async function dial(url, headers) {
  const earlyEvents = []
  dialBuffers.add(earlyEvents)
  try {
    const connectionId = await WSConnect(url, JSON.stringify(Object.fromEntries(headers)))
    return { connectionId, earlyEvents }
  } finally {
    dialBuffers.delete(earlyEvents)
  }
}

export async function openDesktopSocket(url, headers, handlers) {
  subscribe()
  const { connectionId, earlyEvents } = await dial(url, headers)

  const receive = (eventName, event) => {
    if (eventName === MESSAGE_EVENT) {
      handlers.onMessage({ text: event.data })
      return
    }
    if (event.state === STATE_ERROR) handlers.onError(event.detail)
    if (event.state !== STATE_CLOSED) return
    receivers.delete(connectionId)
    handlers.onClose(event.detail)
  }

  receivers.set(connectionId, receive)
  handlers.onOpen()
  earlyEvents
    .filter(([, event]) => event?.connectionId === connectionId)
    .forEach(([eventName, event]) => receive(eventName, event))

  return {
    send: (text) => WSSend(connectionId, text),
    close: () => WSClose(connectionId),
  }
}
