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
} from "../lib/motion"

const CONNECTED_RING_RGB = '34, 211, 238'

/**
 * WebSocket Testing Panel with Enhanced Visuals
 * Allows testing WebSocket connections with real-time messaging and animations
 */

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
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'shadow-lg shadow-blue-500/20'
  },
  [ConnectionState.CONNECTED]: {
    icon: Radio,
    label: 'Connected',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-lg shadow-emerald-500/20'
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

  const connect = () => {
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

    try {
      // Parse headers if provided
      let headersObj = {}
      try {
        headersObj = JSON.parse(headers || '{}')
      } catch {}

      // Note: Native WebSocket API doesn't support custom headers in the constructor
      // Headers would need to be negotiated via the URL or subprotocol
      const protocols = []
      if (headersObj['Sec-WebSocket-Protocol']) {
        protocols.push(headersObj['Sec-WebSocket-Protocol'])
      }

      wsRef.current = new WebSocket(wsUrl, protocols.length > 0 ? protocols : undefined)

      wsRef.current.onopen = () => {
        setState(ConnectionState.CONNECTED)
        addMessage('system', 'success', `Connected to ${wsUrl}`)
      }

      wsRef.current.onmessage = (event) => {
        let data = event.data
        let type = 'message'

        // Try to parse as JSON for pretty display
        try {
          const parsed = JSON.parse(data)
          data = JSON.stringify(parsed, null, 2)
          type = 'json'
        } catch {}

        addMessage('received', type, data)
      }

      wsRef.current.onerror = (error) => {
        setState(ConnectionState.ERROR)
        addMessage('system', 'error', 'WebSocket error occurred')
      }

      wsRef.current.onclose = (event) => {
        setState(ConnectionState.DISCONNECTED)
        addMessage('system', 'info', `Connection closed (${event.code}${event.reason ? ': ' + event.reason : ''})`)

        // Auto-reconnect if enabled
        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }
    } catch (error) {
      setState(ConnectionState.ERROR)
      addMessage('system', 'error', `Failed to connect: ${error.message}`)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState(ConnectionState.DISCONNECTED)
  }

  const send = () => {
    if (!wsRef.current || state !== ConnectionState.CONNECTED) {
      addMessage('system', 'error', 'Not connected')
      return
    }

    if (!message.trim()) return

    try {
      // Send the message
      wsRef.current.send(message)

      // Add to messages as sent
      let displayMessage = message
      let messageType = 'message'

      try {
        const parsed = JSON.parse(message)
        displayMessage = JSON.stringify(parsed, null, 2)
        messageType = 'json'
      } catch {}

      addMessage('sent', messageType, displayMessage)
      setMessage('')
    } catch (error) {
      addMessage('system', 'error', `Failed to send: ${error.message}`)
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
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10" />
        {state === ConnectionState.CONNECTED && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5"
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
                      className="absolute inset-0 rounded-full bg-emerald-500/30 blur-md"
                      animate={pulseRing(CONNECTED_RING_RGB)}
                    />
                    <Radio className="h-5 w-5 text-emerald-400 relative z-10" />
                  </>
                ) : (
                  <Plug className="h-5 w-5 text-cyan-500" />
                )}
              </motion.div>

              <div>
                <span className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
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
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
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
        transition={{ delay: 0.1 }}
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
              className="pl-10 font-mono text-sm bg-background/50 backdrop-blur-sm border-border/50 focus:border-cyan-500/50"
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
        transition={{ delay: 0.2 }}
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
                  <span className="text-cyan-400">wss://echo.websocket.org</span>
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
                        ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 mr-8 border-emerald-500/10'
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
                        className="bg-emerald-500/20 rounded p-1.5"
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      </motion.div>
                    )}
                    {msg.direction === 'system' && (
                      <div className={`rounded p-1.5 ${
                        msg.type === 'error' ? 'bg-destructive/20' :
                          msg.type === 'success' ? 'bg-emerald-500/20' :
                            'bg-muted/30'
                      }`}>
                        {msg.type === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
                          msg.type === 'success' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> :
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
                        ${msg.direction === 'received' ? 'text-emerald-400' : ''}
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
                            <CheckCircle className="h-3 w-3 text-emerald-400" />
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
                    <div className="absolute -inset-0.5 bg-gradient-to-l from-emerald-500/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-sm" />
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
        transition={{ delay: 0.3 }}
      >
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='{{"action": "ping"}'
            className={`flex-1 h-20 font-mono text-sm resize-none bg-background/50 backdrop-blur-sm border-border/50 transition-all ${
              state === ConnectionState.CONNECTED
                ? 'focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10'
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
