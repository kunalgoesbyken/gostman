import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Copy, Check } from "lucide-react"
import { collapse, fadeIn, pressableStrong, scaleInOut } from "../../../lib/motion"
import { EmptyState, METHOD_STYLES, ShowcasePanel, Spinner } from "../ShowcaseParts"
import { useDemoSequence } from "../useDemoSequence"

const REQUEST = {
  method: "GET",
  url: "https://api.gostman.io/v1/users",
  headers: { "Content-Type": "application/json" },
  body: null,
}

const RESPONSE_DATA = {
  status: 200,
  statusText: "OK",
  time: "45ms",
  size: "1.2KB",
  headers: {
    "content-type": "application/json",
    "x-ratelimit-remaining": "97",
    "x-response-time": "45ms",
  },
  body: {
    status: "success",
    data: [
      { id: 101, username: "gopher_fan", role: "admin", email: "gopher@example.com" },
      { id: 102, username: "rust_enjoyer", role: "user", email: "rust@example.com" },
      { id: 103, username: "websocket_dev", role: "user", email: "ws@example.com" },
    ],
  },
}

const DEMO_SEQUENCE = [
  { delay: 1100, action: "send" },
  { delay: 2000, action: "receive" },
]

export const RestShowcase = () => {
  const [response, setResponse] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [copied, setCopied] = useState(false)

  useDemoSequence({
    steps: DEMO_SEQUENCE,
    loopAfter: 6000,
    reset: () => {
      setResponse(null)
      setIsSending(false)
    },
    onStep: ({ action }) => {
      if (action === "send") {
        setIsSending(true)
      } else if (action === "receive") {
        setResponse(RESPONSE_DATA)
        setIsSending(false)
      }
    },
  })

  const copyCode = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="w-full h-full flex flex-col">
      <ShowcasePanel className="flex-1">
        <div className="flex items-center gap-3 p-4 border-b border-border/40 bg-muted/20">
          <motion.div
            className={`px-3 py-1.5 rounded-md font-bold text-sm ${METHOD_STYLES[REQUEST.method]}`}
            key={REQUEST.method}
            {...scaleInOut}
          >
            {REQUEST.method}
          </motion.div>
          <motion.div
            className="flex-1 bg-background rounded-md px-4 py-2 font-mono text-sm text-muted-foreground flex items-center"
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            transition={{ delay: 0.15 }}
          >
            <span className="truncate">{REQUEST.url}</span>
          </motion.div>
          <motion.button
            className={`px-6 py-2 rounded-md font-semibold text-sm flex items-center gap-2 ${isSending
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
              }`}
            animate={isSending ? { scale: [1, 0.95, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {isSending ? (
              <>
                <Spinner className="w-4 h-4" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {response ? (
            <motion.div
              key="response"
              {...collapse}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-emerald-500/5">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-400 font-bold">{response.status}</span>
                  <span className="text-muted-foreground">{response.statusText}</span>
                  <div className="h-4 w-px bg-border/40" />
                  <span className="text-muted-foreground/70">{response.time}</span>
                  <span className="text-muted-foreground/70">{response.size}</span>
                </div>
                <motion.button
                  className="p-2 hover:bg-muted/30 rounded-md transition-colors"
                  onClick={copyCode}
                  {...pressableStrong}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </motion.button>
              </div>

              <div className="flex-1 p-4 font-mono text-sm overflow-auto">
                <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="space-y-1">
                  <div>
                    <span className="text-amber-300">{"{"}</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-blue-300">"status"</span>:
                    <span className="text-emerald-300"> "success"</span>,
                  </div>
                  <div className="pl-4">
                    <span className="text-blue-300">"data"</span>:
                    <span className="text-amber-300"> ["</span>
                  </div>
                  {response.body.data.map((user, i) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.07 }}
                      className="pl-8"
                    >
                      <span className="text-amber-300">{"{"}</span>
                      <div className="pl-4">
                        <span className="text-blue-300">"id"</span>:{" "}
                        <span className="text-purple-300">{user.id}</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-blue-300">"username"</span>:{" "}
                        <span className="text-emerald-300">"{user.username}"</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-blue-300">"role"</span>:{" "}
                        <span className="text-emerald-300">"{user.role}"</span>
                      </div>
                      <span className="text-amber-300">{"},"}</span>
                    </motion.div>
                  ))}
                  <div className="pl-4">
                    <span className="text-amber-300">{"]"}</span>
                  </div>
                  <div>
                    <span className="text-amber-300">{"}"}</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <EmptyState
              icon={Send}
              iconClassName="w-12 h-12"
              message="Send a request to see the response"
              messageClassName="text-sm"
              className="flex-1"
            />
          )}
        </AnimatePresence>
      </ShowcasePanel>
    </div>
  )
}
