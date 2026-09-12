/**
 * Desktop-only WebSocket transport.
 *
 * Go dials the socket, so unlike the browser API it can set arbitrary
 * handshake headers (Authorization, API keys, cookies). Incoming frames and
 * connection-state changes arrive as Wails runtime events.
 *
 * The Wails bindings in `wailsjs/` are thin wrappers over the `go` and
 * `runtime` globals that the Wails asset server injects. This module reads
 * those globals directly rather than importing the bindings, because it is
 * reached from `WebSocketPanel.jsx`, which the web build also bundles: a
 * `wailsjs` import here would cross-wire desktop code into the web app.
 * `resolveTransport` only loads this module once the globals exist.
 */
const MESSAGE_EVENT = 'ws:message'
const STATE_EVENT = 'ws:state'

/**
 * Opens a connection and returns a `{ send, close }` transport.
 * `WSConnect` resolves only once the handshake succeeded, so its resolution
 * is the open signal; the events that follow carry the connection id it
 * returned, which is what distinguishes this socket from any other.
 */
export async function openDesktopSocket(wsUrl, headers, handlers) {
  const bindings = globalThis.go.main.App
  const events = globalThis.runtime

  const connectionId = await bindings.WSConnect(wsUrl, headers || '{}')

  const forThisConnection = (fn) => (event) => {
    if (event?.connectionId === connectionId) fn(event)
  }

  let closed = false
  const unsubscribe = [
    events.EventsOn(MESSAGE_EVENT, forThisConnection((event) => handlers.onMessage(event.data))),
    events.EventsOn(STATE_EVENT, forThisConnection((event) => {
      if (event.state === 'error') handlers.onError(event.detail)
      if (event.state === 'closed') finish(event.detail)
    })),
  ]

  function finish(detail) {
    if (closed) return
    closed = true
    unsubscribe.forEach((off) => off())
    handlers.onClose(detail)
  }

  handlers.onOpen()

  return {
    send: (text) => bindings.WSSend(connectionId, text),
    close: () => bindings.WSClose(connectionId),
  }
}
