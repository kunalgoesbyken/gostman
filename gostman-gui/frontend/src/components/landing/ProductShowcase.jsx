import { useEffect, useRef, useState } from "react"
import { AnimatePresence, m } from "framer-motion"
import { easeSmooth, springLayout } from "../../lib/motion"
import { cn } from "../../lib/utils"
import { whenIdle } from "../../lib/idle"
import { scrollIntoStrip } from "../../lib/scrollIntoStrip"
import graphqlShot from "../../assets/landing/graphql.webp"
import grpcShot from "../../assets/landing/grpc.webp"
import mcpShot from "../../assets/landing/mcp.webp"
import restShot from "../../assets/landing/rest.webp"
import websocketShot from "../../assets/landing/websocket.webp"

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

const ROTATE_MS = 5000
const MOTION_OK = "(prefers-reduced-motion: no-preference)"

const KEY_STEPS = { ArrowRight: 1, ArrowLeft: -1 }

const tabId = (id) => `showcase-tab-${id}`
const panelId = (id) => `showcase-panel-${id}`

function useCenteredInList(ref, isActive) {
  useEffect(() => {
    if (isActive) scrollIntoStrip(ref.current, { center: true, behavior: window.matchMedia(MOTION_OK).matches ? "smooth" : "auto" })
  }, [ref, isActive])
}

function ViewTab({ view, isActive, onSelect }) {
  const ref = useRef(null)
  useCenteredInList(ref, isActive)
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={tabId(view.id)}
      aria-selected={isActive}
      aria-controls={panelId(view.id)}
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "relative shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {isActive && <m.span layoutId="activeShowcaseTab" className="absolute inset-0 -z-10 rounded-md bg-muted" transition={springLayout} />}
      {view.label}
    </button>
  )
}

const preloadViews = () => VIEWS.forEach(({ image }) => {
  new Image().src = image
})

function useRotation(activeId, setActiveId, isPaused) {
  useEffect(() => {
    if (isPaused || !window.matchMedia(MOTION_OK).matches) return undefined
    const timer = setTimeout(() => {
      const index = VIEWS.findIndex((view) => view.id === activeId)
      setActiveId(VIEWS[(index + 1) % VIEWS.length].id)
    }, ROTATE_MS)
    return () => clearTimeout(timer)
  }, [activeId, setActiveId, isPaused])
}

export function ProductShowcase() {
  const [activeId, setActiveId] = useState(VIEWS[0].id)
  const [isHovered, setIsHovered] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const active = VIEWS.find((view) => view.id === activeId)
  useRotation(activeId, setActiveId, isHovered || hasInteracted)
  useEffect(() => whenIdle(preloadViews), [])

  const select = (id) => {
    setHasInteracted(true)
    setActiveId(id)
  }

  const handleKeyDown = (event) => {
    const step = KEY_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const next = VIEWS[(VIEWS.indexOf(active) + step + VIEWS.length) % VIEWS.length]
    select(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
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
          className="isolate inline-flex max-w-full shrink-0 items-center gap-1 self-start overflow-x-auto rounded-lg border border-border/40 bg-muted/20 p-1 scrollbar-none sm:self-auto"
        >
          {VIEWS.map((view) => (
            <ViewTab key={view.id} view={view} isActive={view.id === activeId} onSelect={() => select(view.id)} />
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={panelId(active.id)}
        aria-labelledby={tabId(active.id)}
        className="mt-6 rounded-xl border border-border/50 bg-card/40 p-1.5 shadow-[0_30px_80px_-24px_hsl(var(--primary)/0.4)] sm:p-2"
      >
        <div className="aspect-[8/5] overflow-hidden rounded-lg border border-primary/25 bg-background">
          <AnimatePresence mode="wait" initial={false}>
            <m.img
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
    </div>
  )
}
