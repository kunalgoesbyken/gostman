import { StreamRequest } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const STREAM_EVENT = 'sse:messages'

const listeners = new Map()
let isSubscribed = false

function subscribe() {
  if (isSubscribed) return
  isSubscribed = true
  EventsOn(STREAM_EVENT, (batch) => listeners.get(batch.streamId)?.(batch.messages))
}

export async function openDesktopStream(streamId, request, onMessages) {
  subscribe()
  listeners.set(streamId, onMessages)
  try {
    return await StreamRequest(streamId, request)
  } finally {
    listeners.delete(streamId)
  }
}
