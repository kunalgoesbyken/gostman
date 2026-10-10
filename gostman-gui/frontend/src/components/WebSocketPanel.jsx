import { memo, useLayoutEffect, useMemo, useRef } from "react"
import { ArrowDown, ArrowUp, Copy, Info, TriangleAlert } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { pluralize } from "../lib/dataUtils"
import {
  ENTRY_ERROR,
  ENTRY_INFO,
  ENTRY_RECEIVED,
  ENTRY_SENT,
  LOG_LIMIT,
  SOCKET_CONNECTING,
  SOCKET_IDLE,
  SOCKET_OPEN,
  SOCKET_WAITING,
  resolveSocketTarget,
  selectSession,
  useSocketStore,
} from "../lib/socketSessions"
import { cn } from "../lib/utils"

const PINNED_DISTANCE_PX = 24
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

const STATUS_VIEWS = {
  [SOCKET_IDLE]: { label: "Disconnected", dot: "bg-muted-foreground/50" },
  [SOCKET_CONNECTING]: { label: "Connecting", dot: "bg-warning" },
  [SOCKET_OPEN]: { label: "Connected", dot: "bg-success" },
  [SOCKET_WAITING]: { label: "Waiting to reconnect", dot: "bg-warning" },
}

const ENTRY_VIEWS = {
  [ENTRY_SENT]: { icon: ArrowUp, label: "Sent", tone: "text-primary" },
  [ENTRY_RECEIVED]: { icon: ArrowDown, label: "Received", tone: "text-success" },
  [ENTRY_INFO]: { icon: Info, label: "Info", tone: "text-muted-foreground" },
  [ENTRY_ERROR]: { icon: TriangleAlert, label: "Error", tone: "text-destructive" },
}

const NOTICE = "shrink-0 border-b border-border/50 px-4 py-2 text-xs text-muted-foreground"

function entryNote(entry) {
  if (entry.byteCount !== undefined) return `Binary, ${pluralize(entry.byteCount, "byte")}`
  if (entry.fullLength !== undefined) return `Showing the first ${entry.text.length} of ${entry.fullLength} characters`
  return ""
}

const LogEntry = memo(function LogEntry({ entry }) {
  const { icon: Icon, label, tone } = ENTRY_VIEWS[entry.kind]
  const note = entryNote(entry)
  const isMessage = entry.kind === ENTRY_SENT || entry.kind === ENTRY_RECEIVED
  const copy = () => navigator.clipboard.writeText(entry.text).catch(() => {})

  return (
    <li className="group grid grid-cols-[4rem_1rem_minmax(0,1fr)_1.5rem] items-start gap-2 border-b border-border/30 px-4 py-1.5">
      <time className="font-mono text-[11px] leading-5 text-muted-foreground">{TIME_FORMAT.format(entry.time)}</time>
      <Icon aria-label={label} className={cn("mt-1 h-3.5 w-3.5", tone)} />
      <div className="min-w-0">
        {note && <p className="text-[11px] leading-5 text-muted-foreground">{note}</p>}
        <pre className={cn("whitespace-pre-wrap break-all font-mono text-xs leading-5", isMessage ? "text-foreground" : tone)}>{entry.text}</pre>
      </div>
      {isMessage && (
        <button
          type="button"
          onClick={copy}
          aria-label="Copy message"
          title="Copy message"
          className="mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  )
})

function MessageLog({ entries, dropped }) {
  const logRef = useRef(null)
  const isPinned = useRef(true)

  useLayoutEffect(() => {
    const log = logRef.current
    if (isPinned.current) log.scrollTop = log.scrollHeight
  }, [entries])

  const trackPosition = (event) => {
    const log = event.currentTarget
    isPinned.current = log.scrollHeight - log.scrollTop - log.clientHeight <= PINNED_DISTANCE_PX
  }

  return (
    <div ref={logRef} onScroll={trackPosition} className="min-h-0 flex-1 overflow-y-auto scrollbar-primary">
      {dropped > 0 && (
        <p className="border-b border-border/30 px-4 py-1.5 text-xs text-muted-foreground">
          Older entries dropped: {dropped}. The log keeps the latest {LOG_LIMIT}.
        </p>
      )}
      {entries.length === 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          No messages yet. Connect, then send a message or wait for the server to speak.
        </p>
      )}
      <ul>
        {entries.map((entry) => <LogEntry key={entry.id} entry={entry} />)}
      </ul>
    </div>
  )
}

export function WebSocketPanel({ tabId, request, variables, sockets }) {
  const session = useSocketStore(selectSession(tabId))
  const { url, headers } = request
  const target = useMemo(() => resolveSocketTarget({ url, headers }, variables), [url, headers, variables])
  const unsentHeaders = target.error ? [] : sockets.unsentHeaders(target.headers)
  const status = STATUS_VIEWS[session.status]
  const isIdle = session.status === SOCKET_IDLE
  const isOpen = session.status === SOCKET_OPEN
  const canSend = isOpen && session.draft !== ""

  const handleComposerKey = (event) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return
    event.preventDefault()
    event.stopPropagation()
    sockets.sendMessage(tabId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border/50 px-4">
        <span className="flex shrink-0 items-center gap-2 text-xs text-foreground">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", status.dot)} />
          {status.label}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={target.url || target.error}>
          {target.url || target.error}
        </span>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={session.autoReconnect}
            onChange={(event) => sockets.setAutoReconnect(tabId, event.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Auto-reconnect
        </label>
        {isIdle ? (
          <Button type="button" size="sm" className="h-7 shrink-0 px-3" disabled={Boolean(target.error)} onClick={() => sockets.connect(tabId)}>
            Connect
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-3" onClick={() => sockets.disconnect(tabId)}>
            Disconnect
          </Button>
        )}
      </div>

      {unsentHeaders.length > 0 && (
        <p className={NOTICE}>
          A browser can only set Sec-WebSocket-Protocol on a WebSocket. Not sent from here: {unsentHeaders.join(", ")}. The desktop app sends every header.
        </p>
      )}

      <MessageLog entries={session.entries} dropped={session.dropped} />

      <div className="flex shrink-0 items-stretch gap-2 border-t border-border/50 px-4 py-3">
        <Textarea
          value={session.draft}
          onChange={(event) => sockets.setDraft(tabId, event.target.value)}
          onKeyDown={handleComposerKey}
          placeholder={isOpen ? "Message (Ctrl+Enter to send)" : "Connect to send messages"}
          aria-label="Message"
          disabled={!isOpen}
          spellCheck={false}
          className="h-16 min-h-0 flex-1 resize-none font-mono text-xs"
        />
        <div className="flex shrink-0 flex-col justify-between">
          <Button type="button" size="sm" className="h-7 px-3" disabled={!canSend} onClick={() => sockets.sendMessage(tabId)}>
            Send
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-3"
            disabled={session.entries.length === 0}
            onClick={() => sockets.clearLog(tabId)}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
