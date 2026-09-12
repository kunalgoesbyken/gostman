import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plug, Unplug, Send, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Radio, Waves, Copy } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import {
  fadeIn,
  slideUp,
  slideDown,
  scaleInOut,
  scaleInOutSubtle,
  streamItem,
  pressable,
  pressableIcon,
  pulseRing,
  pulseScale,
  pulseOpacity,
  heartbeat,
  spin,
  float,
  spring,
  springSnappy,
  durationBase,
  enterDelay,
} from "../lib/motion"

const CONNECTED_RING_RGB = '34, 211, 238'
const RECONNECT_DELAY_MS = 3000

/**
 * Picks the transport for the current target.
 *
 * The desktop build routes through Go, which can set arbitrary handshake
 * headers; the web build is stuck with the browser API. The `go` global only
 * exists under Wails, and the desktop module is loaded lazily behind that
 * check, so the web app never evaluates desktop code - this module is part of
 * the web bundle too, because RequestBar and RequestTabs import
 * `isWebSocketURL` from it.
 */
async function resolveTransport() {
  if (!globalThis.go) return openBrowserSocket
  const { openDesktopSocket } = await import("./websocketDesktop")
  return openDesktopSocket
}

const parseHeaders = (headers) => {
  try {
    return JSON.parse(headers || '{}')
  } catch {
    return {}
  }
}

// Pretty-prints JSON payloads, returning the text to show and its message type.
const formatPayload = (payload) => {
  try {
    return [JSON.stringify(JSON.parse(payload), null, 2), 'json']
  } catch {
    return [payload, 'message']
  }
}

/**
 * Both transports resolve to the same shape - `{ send(text), close() }` - and
 * report activity through a handlers object of
 * `{ onOpen, onMessage, onError, onClose }`.
 */
function openBrowserSocket(wsUrl, headers, handlers) {
  // The native WebSocket API cannot set handshake headers, so only
  // Sec-WebSocket-Protocol survives - it maps onto the subprotocol argument.
  // The desktop transport below has no such limit.
  const protocol = parseHeaders(headers)['Sec-WebSocket-Protocol']
  const socket = new WebSocket(wsUrl, protocol ? [protocol] : undefined)

  socket.onopen = () => handlers.onOpen()
  socket.onmessage = (event) => handlers.onMessage(event.data)
  socket.onerror = () => handlers.onError('WebSocket error occurred')
  socket.onclose = (event) =>
    handlers.onClose(`Connection closed (${event.code}${event.reason ? ': ' + event.reason : ''})`)

  return {
    send: (text) => socket.send(text),
    close: () => socket.close(),
  }
}

const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
}

// Status configurations with enhanced visuals
const StatusConfig = {
  [ConnectionState.DISCONNECTED]: {
    icon: Unplug,
    label: 'Disconnected',
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    border: 'border-border/50',
    glow: null
  },
  [ConnectionState.CONNECTING]: {
    icon: Clock,
    label: 'Connecting...',
    color: 'text-info',
    bg: 'bg-info/10',
    border: 'border-info/20',
    glow: 'shadow-lg shadow-info/20'
  },
  [ConnectionState.CONNECTED]: {
    icon: Radio,
    label: 'Connected',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/20',
    glow: 'shadow-lg shadow-success/20'
  },
  [ConnectionState.ERROR]: {
    icon: XCircle,
    label: 'Error',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    glow: 'shadow-lg shadow-destructive/20'
  }
}

/**
 * WebSocket Testing Panel with Enhanced Visuals
 * Allows testing WebSocket connections with real-time messaging and animations
 */
export function WebSocketPanel({
  url,
  onUrlChange,
  headers
}) {
  const [state, setState] = useState(ConnectionState.DISCONNECTED)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [autoReconnect, setAutoReconnect] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Read from the close handler, which captures the value at connect time.
  const autoReconnectRef = useRef(autoReconnect)
  autoReconnectRef.current = autoReconnect

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const connect = async () => {
    if (!url || !url.trim()) {
      addMessage('system', 'error', 'Please enter a WebSocket URL')
      return
    }

    // Convert ws:// to wss:// if needed for secure connections
    let wsUrl = url.trim()
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://')
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://')
    }

    setState(ConnectionState.CONNECTING)
    addMessage('system', 'info', `Connecting to ${wsUrl}...`)

    const handlers = {
      onOpen: () => {
        setState(ConnectionState.CONNECTED)
        addMessage('system', 'success', `Connected to ${wsUrl}`)
      },
      onMessage: (data) => {
        const [content, type] = formatPayload(data)
        addMessage('received', type, content)
      },
      onError: (detail) => {
        setState(ConnectionState.ERROR)
        addMessage('system', 'error', detail)
      },
      onClose: (detail) => {
        wsRef.current = null
        setState(ConnectionState.DISCONNECTED)
        addMessage('system', 'info', detail)

        if (autoReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      },
    }

    try {
      const open = await resolveTransport()
      wsRef.current = await open(wsUrl, headers, handlers)
    } catch (error) {
      setState(ConnectionState.ERROR)
      addMessage('system', 'error', `Failed to connect: ${error.message || error}`)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    wsRef.current?.close()
    wsRef.current = null

    setState(ConnectionState.DISCONNECTED)
  }

  const send = async () => {
    if (!wsRef.current || state !== ConnectionState.CONNECTED) {
      addMessage('system', 'error', 'Not connected')
      return
    }

    if (!message.trim()) return

    try {
      await wsRef.current.send(message)

      const [displayMessage, messageType] = formatPayload(message)
      addMessage('sent', messageType, displayMessage)
      setMessage('')
    } catch (error) {
      addMessage('system', 'error', `Failed to send: ${error.message || error}`)
    }
  }

  const addMessage = (direction, type, content) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      direction,
      type,
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
  }

  const clearMessages = () => {
    setMessages([])
  }

  const copyMessage = (content, id) => {
    navigator.clipboard.writeText(content)
    setCopiedMessage(id)
    setTimeout(() => setCopiedMessage(null), 2000)
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const statusConfig = StatusConfig[state]
  const StatusIcon = statusConfig.icon

  return (
    <motion.div
      className="flex flex-col h-full"
      {...fadeIn}
      transition={durationBase}
    >
      <motion.div
        className="relative overflow-hidden"
        {...slideDown}
        transition={spring}
      >
        
        {state === ConnectionState.CONNECTED && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-success/5 to-primary/5"
            animate={pulseOpacity}
          />
        )}

        <div className="relative px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative"
                animate={state === ConnectionState.CONNECTED ? pulseScale : {}}
              >
                {state === ConnectionState.CONNECTED ? (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full bg-success/30 blur-md"
                      animate={pulseRing(CONNECTED_RING_RGB)}
                    />
                    <Radio className="h-5 w-5 text-success relative z-10" />
                  </>
                ) : (
                  <Plug className="h-5 w-5 text-primary" />
                )}
              </motion.div>

              <div>
                <span className="text-sm font-semibold text-foreground">
                  WebSocket
                </span>
                <motion.div
                  key={state}
                  initial={scaleInOut.initial}
                  animate={scaleInOut.animate}
                  className={`flex items-center gap-1.5 mt-0.5 ${statusConfig.color}`}
                >
                  {state === ConnectionState.CONNECTED && (
                    <motion.div
                      animate={heartbeat}
                      className="w-1.5 h-1.5 rounded-full bg-success/40"
                    />
                  )}
                  {state === ConnectionState.CONNECTING && (
                    <motion.div animate={spin}>
                      <Clock className="h-3 w-3" />
                    </motion.div>
                  )}
                  {state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING && (
                    <StatusIcon className="h-3 w-3" />
                  )}
                  <span className="text-[10px] font-medium">{statusConfig.label}</span>
                </motion.div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.label
                className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded-md hover:bg-muted/30 transition-colors"
                {...pressable}
              >
                <motion.div
                  className="relative"
                  animate={autoReconnect ? { backgroundColor: ['hsl(var(--primary))'] } : {}}
                >
                  <input
                    type="checkbox"
                    checked={autoReconnect}
                    onChange={(e) => setAutoReconnect(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors ${autoReconnect ? 'bg-primary' : 'bg-muted'}`}>
                    <motion.div
                      className="w-3 h-3 rounded-full bg-white shadow-sm mt-0.5"
                      animate={{ x: autoReconnect ? 16 : 2 }}
                      transition={springSnappy}
                    />
                  </div>
                </motion.div>
                <span className="text-[10px] uppercase tracking-wide">Auto-reconnect</span>
              </motion.label>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="px-4 py-3 border-b border-border/50"
        {...slideUp}
        {...enterDelay(0.1)}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">
              ws://
            </div>
            <Input
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="echo.websocket.org"
              className="pl-10 font-mono text-sm bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary/50"
              disabled={state === ConnectionState.CONNECTED || state === ConnectionState.CONNECTING}
            />
          </div>
          <AnimatePresence mode="wait">
            {state === ConnectionState.CONNECTED || state === ConnectionState.CONNECTING ? (
              <motion.div
                key="disconnect"
                {...scaleInOut}
              >
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={disconnect}
                  className="gap-2"
                >
                  <Unplug className="h-4 w-4" />
                  Disconnect
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="connect"
                {...scaleInOut}
              >
                <Button
                  size="sm"
                  onClick={connect}
                  className="gap-2"
                >
                  <Plug className="h-4 w-4" />
                  Connect
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-background"
        {...fadeIn}
        {...enterDelay(0.2)}
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <motion.div
              key="empty"
              {...scaleInOutSubtle}
              className="flex items-center justify-center h-full text-muted-foreground text-sm"
            >
              <div className="text-center">
                <motion.div
                  animate={float}
                >
                  <Waves className="h-12 w-12 mx-auto mb-3 opacity-30" />
                </motion.div>
                <p className="text-sm font-medium">Ready to connect</p>
                <p className="text-xs mt-1 text-muted-foreground">Enter a WebSocket URL to begin messaging</p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/30 text-xs font-mono">
                  <span className="text-muted-foreground">Try:</span>
                  <span className="text-primary">wss://echo.websocket.org</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  layout
                  variants={streamItem}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={`
                    relative group flex gap-3 p-3 rounded-lg text-sm border
                    ${msg.direction === 'sent'
                      ? 'bg-gradient-to-r from-primary/10 to-primary/5 ml-8 border-primary/10'
                      : msg.direction === 'received'
                        ? 'bg-gradient-to-r from-success/10 to-success/5 mr-8 border-success/10'
                        : 'bg-muted/20 border-border/50'
                    }
                  `}
                >
                  <div className="shrink-0 pt-0.5">
                    {msg.direction === 'sent' && (
                      <motion.div
                        initial={{ rotate: -45 }}
                        animate={{ rotate: 0 }}
                        className="bg-primary/20 rounded p-1.5"
                      >
                        <Send className="h-3.5 w-3.5 text-primary" />
                      </motion.div>
                    )}
                    {msg.direction === 'received' && (
                      <motion.div
                        initial={{ rotate: 45 }}
                        animate={{ rotate: 0 }}
                        className="bg-success/20 rounded p-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                      </motion.div>
                    )}
                    {msg.direction === 'system' && (
                      <div className={`rounded p-1.5 ${
                        msg.type === 'error' ? 'bg-destructive/20' :
                          msg.type === 'success' ? 'bg-success/20' :
                            'bg-muted/30'
                      }`}>
                        {msg.type === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
                          msg.type === 'success' ? <CheckCircle className="h-3.5 w-3.5 text-success" /> :
                            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`
                        text-[10px] font-bold uppercase tracking-wider
                        ${msg.direction === 'sent' ? 'text-primary' : ''}
                        ${msg.direction === 'received' ? 'text-success' : ''}
                        ${msg.direction === 'system' ? 'text-muted-foreground' : ''}
                      `}>
                        {msg.direction === 'sent' ? 'SENT' : msg.direction === 'received' ? 'RECEIVED' : 'SYSTEM'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatTime(msg.timestamp)}
                        </span>
                        <motion.button
                          {...pressableIcon}
                          onClick={() => copyMessage(msg.content, msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedMessage === msg.id ? (
                            <CheckCircle className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          )}
                        </motion.button>
                      </div>
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words overflow-x-auto bg-background/30 rounded p-2 border border-border/20">
                      {msg.content}
                    </pre>
                  </div>

                  {msg.direction === 'sent' && (
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-sm" />
                  )}
                  {msg.direction === 'received' && (
                    <div className="absolute -inset-0.5 bg-gradient-to-l from-success/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-sm" />
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        className="border-t border-border/50 p-4 bg-gradient-to-t from-muted/30 to-transparent"
        {...slideUp}
        {...enterDelay(0.3)}
      >
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='{{"action": "ping"}'
            className={`flex-1 h-20 font-mono text-sm resize-none bg-background/50 backdrop-blur-sm border-border/50 transition-all ${
              state === ConnectionState.CONNECTED
                ? 'focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
                : 'opacity-50 cursor-not-allowed'
            }`}
            disabled={state !== ConnectionState.CONNECTED}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                send()
              }
            }}
          />
          <motion.div
            className="absolute bottom-2 right-2 text-[10px] text-muted-foreground"
            animate={{ opacity: message.length > 0 ? 1 : 0 }}
          >
            {message.length} chars
          </motion.div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/30 font-mono text-[10px]">Ctrl</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/30 font-mono text-[10px]">Enter</kbd>
            <span className="ml-1">to send</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div {...pressable}>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearMessages}
                disabled={messages.length === 0}
                className="gap-1.5"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </motion.div>
            <motion.div {...pressable}>
              <Button
                size="sm"
                onClick={send}
                disabled={state !== ConnectionState.CONNECTED || !message.trim()}
                className="gap-2"
              >
                <Send className="h-3 w-3" />
                Send
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Detects if a URL is a WebSocket URL
 */
export function isWebSocketURL(url) {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim().toLowerCase()
  return trimmed.startsWith('ws://') || trimmed.startsWith('wss://')
}
