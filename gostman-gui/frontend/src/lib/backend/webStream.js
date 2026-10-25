import { failureResponse } from '../response'
import { WEB_BACKEND_TEXT } from '../webBackendText'
import {
  END_CANCELLED, END_FAILED, MESSAGE_END, MESSAGE_OPEN, MESSAGE_RESPONSE, SSE_PROTOCOL,
} from '../sse'

export const STREAM_CAP_SECONDS = 60

const LINE_BREAK = '\n'
const JSON_TYPE = 'application/json'
const NETWORK_ERROR = 'network'

function splitLines(text, pending) {
  const parts = (pending.text + text).split(LINE_BREAK)
  pending.text = parts.pop()
  return parts.filter(Boolean)
}

async function readMessages(body, onMessages, track) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const pending = { text: '' }
  for (;;) {
    const { done, value } = await reader.read()
    const text = done ? decoder.decode() : decoder.decode(value, { stream: true })
    const messages = splitLines(text, pending).map((line) => JSON.parse(line))
    track(messages)
    onMessages(messages.filter((message) => message.kind !== MESSAGE_RESPONSE))
    if (done) return
  }
}

function endOutcome(state, aborted, detail) {
  const ended = { kind: MESSAGE_END, reason: aborted ? END_CANCELLED : END_FAILED, detail }
  if (state.opened) {
    return { ended, response: { ...state.opened, protocol: SSE_PROTOCOL, durationMs: Date.now() - state.started } }
  }
  return { ended, response: aborted ? failureResponse(END_CANCELLED, WEB_BACKEND_TEXT.cancelled) : failureResponse(NETWORK_ERROR, detail) }
}

export async function readStream(url, payload, onMessages, signal) {
  const state = { started: Date.now(), opened: null, final: null }
  const track = (messages) => messages.forEach((message) => {
    if (message.kind === MESSAGE_OPEN) state.opened = message.response
    if (message.kind === MESSAGE_RESPONSE) state.final = message.response
  })
  try {
    const answer = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': JSON_TYPE },
      body: JSON.stringify(payload),
      signal,
    })
    if ((answer.headers.get('content-type') || '').includes(JSON_TYPE)) return await answer.json()
    if (!answer.ok) throw new Error(WEB_BACKEND_TEXT.proxyAnswered(answer.status))
    await readMessages(answer.body, onMessages, track)
  } catch (error) {
    const outcome = endOutcome(state, signal.aborted, error.message)
    onMessages([outcome.ended])
    return outcome.response
  }
  if (state.final) return state.final
  const outcome = endOutcome(state, false, WEB_BACKEND_TEXT.streamCutOff)
  onMessages([outcome.ended])
  return outcome.response
}
