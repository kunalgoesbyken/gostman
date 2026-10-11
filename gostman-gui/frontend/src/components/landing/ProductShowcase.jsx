import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { easeSmooth, springLayout } from "../../lib/motion"
import { cn } from "../../lib/utils"
import graphqlShot from "../../assets/landing/graphql.png"
import grpcShot from "../../assets/landing/grpc.png"
import mcpShot from "../../assets/landing/mcp.png"
import restShot from "../../assets/landing/rest.png"
import websocketShot from "../../assets/landing/websocket.png"

const VIEWS = [
  {
    id: "rest",
    label: "REST",
    description: "Any method, with JSON, form, multipart or file bodies, and the response as a tree, raw text or a preview.",
    image: restShot,
    alt: "A POST request with a JSON body and its JSON response",
  },
  {
    id: "graphql",
    label: "GraphQL",
    description: "Write a query with variables, browse the schema by introspection, and read the result beside it.",
    image: graphqlShot,
    alt: "A GraphQL query with variables and the data it returned",
  },
  {
    id: "grpc",
    label: "gRPC",
    description: "Load services through reflection or .proto files, pick a method and send the message as JSON.",
    image: grpcShot,
    alt: "A gRPC method call with a JSON message and the reply",
  },
  {
    id: "mcp",
    label: "MCP",
    description: "Point a request at an MCP server, load its tools, call one with JSON arguments and check the result.",
    image: mcpShot,
    alt: "An MCP tool call with JSON arguments and the tool result",
  },
  {
    id: "websocket",
    label: "WebSocket",
    description: "Connect, send messages and watch every frame arrive in a live log.",
    image: websocketShot,
    alt: "An open WebSocket connection with sent and received messages",
  },
]

const KEY_STEPS = { ArrowRight: 1, ArrowLeft: -1 }

const tabId = (id) => `showcase-tab-${id}`
const panelId = (id) => `showcase-panel-${id}`

function ViewTab({ view, isActive, onSelect }) {
  return (
    <button
      type="button"
      role="tab"
      id={tabId(view.id)}
      aria-selected={isActive}
      aria-controls={panelId(view.id)}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "relative whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {isActive && <motion.span layoutId="activeShowcaseTab" className="absolute inset-0 -z-10 rounded-md bg-muted" transition={springLayout} />}
      {view.label}
    </button>
  )
}

export function ProductShowcase() {
  const [activeId, setActiveId] = useState(VIEWS[0].id)
  const active = VIEWS.find((view) => view.id === activeId)

  const handleKeyDown = (event) => {
    const step = KEY_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const next = VIEWS[(VIEWS.indexOf(active) + step + VIEWS.length) % VIEWS.length]
    setActiveId(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight [text-wrap:balance]">
            Every protocol in one window
          </h2>
          <p className="mt-3 min-h-[3.25rem] leading-relaxed text-muted-foreground">{active.description}</p>
        </div>
        <div
          role="tablist"
          aria-label="Protocols"
          onKeyDown={handleKeyDown}
          className="isolate inline-flex shrink-0 items-center gap-1 self-start overflow-x-auto rounded-lg border border-border/40 bg-muted/20 p-1 scrollbar-none sm:self-auto"
        >
          {VIEWS.map((view) => (
            <ViewTab key={view.id} view={view} isActive={view.id === activeId} onSelect={() => setActiveId(view.id)} />
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId(active.id)}
        aria-labelledby={tabId(active.id)}
        className="mt-6 aspect-[1240/760] overflow-hidden rounded-lg border border-border/60 bg-background"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={active.id}
            src={active.image}
            alt={active.alt}
            className="h-full w-full object-cover object-left-top"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeSmooth }}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}
