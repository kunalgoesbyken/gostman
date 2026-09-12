import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Radio, Send, MessageSquare, Activity, Wifi, WifiOff } from "lucide-react"
import { collapse, fadeIn, slideDown, slideUp } from "../../../lib/motion"
import { ShowcaseFooter, ShowcaseHeader } from "../ShowcaseParts"
import { useDemoSequence } from "../useDemoSequence"

const WS_URL = "wss://api.gostman.io/realtime"

const message = (type, text, event) => ({ action: "addMessage", data: { type, text, event } })

const DEMO_SEQUENCE = [
  { delay: 0, action: "connect" },
  { delay: 500, ...message("server", "Connected to server", "open") },
  { delay: 1000, ...message("client", '{"action":"subscribe","channel":"prices"}', "message") },
  { delay: 1600, ...message("server", '{"channel":"prices","data":{"symbol":"BTC","price":67234.50}}', "data") },
  { delay: 2200, ...message("server", '{"channel":"prices","data":{"symbol":"ETH","price":3456.78}}', "data") },
  { delay: 2900, ...message("client", '{"action":"unsubscribe","channel":"prices"}', "message") },
  { delay: 3500, ...message("server", "Unsubscribed from prices", "close") },
  { delay: 4100, action: "disconnect" },
]

const formatTime = (date) =>
  date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })

const bubbleStyle = (msg) => {
  if (msg.type === "client") return "bg-primary/20 text-foreground border border-primary/20"
  if (msg.event === "open" || msg.event === "close")
    return "bg-muted/30 text-muted-foreground border border-border/30"
  return "bg-emerald-500/10 text-emerald-50 border border-emerald-500/20"
}

export const WebSocketShowcase = () => {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const scrollRef = useRef(null)

  useDemoSequence({
    steps: DEMO_SEQUENCE,
    loopAfter: 6000,
    reset: () => {
      setMessages([])
      setConnected(false)
    },
    onStep: ({ action, data }) => {
      if (action === "connect") setConnected(true)
      else if (action === "disconnect") setConnected(false)
      else if (action === "addMessage")
        setMessages((prev) => [...prev, { ...data, id: Date.now() + Math.random(), timestamp: new Date() }])
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="w-full h-full flex flex-col">
      <ShowcaseHeader
        icon={Radio}
        iconClassName="text-cyan-400"
        tint="bg-cyan-500/10"
        title="WebSocket Connection"
        subtitle="Real-time bidirectional messaging"
      >
        <motion.div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${connected
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
              : "text-muted-foreground bg-muted/10 border-border/20"
            }`}
          animate={connected ? { opacity: [0.9, 1, 0.9] } : {}}
          transition={{ duration: 2, repeat: connected ? Infinity : 0, ease: "easeInOut" }}
        >
          {connected ? (
            <>
              <motion.span
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Disconnected
            </>
          )}
        </motion.div>
      </ShowcaseHeader>

      <motion.div
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-background/60 border border-border/60 mb-4"
        {...slideDown}
      >
        <Wifi className={`w-4 h-4 ${connected ? "text-emerald-400" : "text-muted-foreground"}`} />
        <code className="flex-1 font-mono text-sm text-muted-foreground truncate">{WS_URL}</code>
        <div
          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${connected
              ? "bg-red-500/10 text-red-400"
              : "bg-emerald-500/10 text-emerald-400"
            }`}
        >
          {connected ? "Disconnect" : "Connect"}
        </div>
      </motion.div>

      <motion.div
        ref={scrollRef}
        className="flex-1 rounded-lg bg-background/40 border border-border/60 overflow-hidden flex flex-col"
        {...fadeIn}
        transition={{ delay: 0.1 }}
      >
        <div className="flex-1 p-4 space-y-2.5 overflow-auto font-mono text-xs">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                {...slideUp}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex ${msg.type === "client" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] rounded-lg px-3 py-2 ${bubbleStyle(msg)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {msg.type === "client" ? (
                      <Send className="w-3 h-3 opacity-60" />
                    ) : (
                      <MessageSquare className="w-3 h-3 text-emerald-400/60" />
                    )}
                    <span className="text-[10px] opacity-60">{formatTime(msg.timestamp)}</span>
                    {msg.event !== "message" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-background/50">
                        {msg.event}
                      </span>
                    )}
                  </div>
                  <div className="break-all leading-relaxed text-[11px]">
                    {msg.text.startsWith("{") ? (
                      <span className="text-emerald-300">{msg.text.slice(0, 60)}{msg.text.length > 60 ? "..." : ""}</span>
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {connected && (
            <motion.div
              {...collapse}
              transition={{ duration: 0.2 }}
              className="px-4 py-2 border-t border-border/40 bg-muted/10 flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Listening for messages...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ShowcaseFooter tag="Full-Duplex" tagClassName="bg-cyan-500/10 text-cyan-400">
        <span>Send and receive messages in real-time</span>
      </ShowcaseFooter>
    </div>
  )
}
