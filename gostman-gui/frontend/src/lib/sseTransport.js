import { applyMessages, beginSession, removeSession } from './sseSessions'
import { MESSAGE_EVENT, SSE_PROTOCOL, eventsToText } from './sse'
import { toEngineRequest } from './request'
import { failureResponse } from './response'

const NETWORK_ERROR = 'network'

function settle(streamId, response, received) {
  if (response.protocol !== SSE_PROTOCOL) {
    removeSession(streamId)
    return response
  }
  return { ...response, streamId, body: eventsToText(received), bodyEncoding: 'utf8' }
}

export const transmitStream = (backend) => async (streamId, request, variables, cookies) => {
  const received = []
  const onMessages = (messages) => {
    messages.forEach((message) => message.kind === MESSAGE_EVENT && received.push(message.event))
    applyMessages(streamId, messages)
  }
  beginSession(streamId, backend.streamCapSeconds)
  try {
    const response = await backend.openStream(streamId, toEngineRequest(request, variables, cookies), onMessages)
    return settle(streamId, response, received)
  } catch (error) {
    removeSession(streamId)
    return failureResponse(NETWORK_ERROR, error?.message || String(error))
  }
}
