import { memo, useLayoutEffect, useMemo, useRef } from "react"
import { ArrowDown, ArrowUp, Copy, Info, Radio, TriangleAlert } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { EmptyState } from "./ui/emptyState"
import { Notice, Panel, Toolbar } from "./ui/panel"
import { Textarea } from "./ui/textarea"
import { pluralize } from "../lib/dataUtils"
import { shortcutLabel } from "../lib/platform"
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
  [SOCKET_IDLE]: { label: "Disconnected", dot: "bg-muted-foreground" },
  [SOCKET_CONNECTING]: { label: "Connecting", dot: "bg-warning" },
  [SOCKET_OPEN]: { label: "Connected", dot: "bg-success" },
  [SOCKET_WAITING]: { label: "Waiting to reconnect", dot: "bg-warning" },
}

const ENTRY_VIEWS = {
  [ENTRY_SENT]: { icon: ArrowUp, label: "Sent", tone: "text-info" },
  [ENTRY_RECEIVED]: { icon: ArrowDown, label: "Received", tone: "text-success" },
  [ENTRY_INFO]: { icon: Info, label: "Info", tone: "text-muted-foreground" },
  [ENTRY_ERROR]: { icon: TriangleAlert, label: "Error", tone: "text-destructive" },
}

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
    <li className="group grid grid-cols-[3.75rem_1rem_minmax(0,1fr)_1.5rem] items-start gap-2 border-b border-border px-3 py-1">
      <time className="font-mono text-[11px] leading-6 text-muted-foreground">{TIME_FORMAT.format(entry.time)}</time>
      <Icon aria-label={label} className={cn("mt-[5px] h-3.5 w-3.5", tone)} />
      <div className="min-w-0 py-0.5">
        {note && <p className="text-[11px] leading-5 text-muted-foreground">{note}</p>}
        <pre className={cn("whitespace-pre-wrap break-all font-mono text-xs leading-5", isMessage ? "text-foreground" : tone)}>{entry.text}</pre>
      </div>
      {isMessage && (
        <IconButton
          label="Copy message"
          icon={Copy}
          size="icon-xs"
          onClick={copy}
          className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        />
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
    <div ref={logRef} onScroll={trackPosition} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      {dropped > 0 && <Notice>Older entries dropped: {dropped}. The log keeps the latest {LOG_LIMIT}.</Notice>}
      {entries.length === 0 && (
        <EmptyState icon={Radio} title="No messages yet" description="Connect, then send a message or wait for the server." />
      )}
      <ul aria-label="Messages">
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
    <Panel>
      <Toolbar>
        <span className="flex shrink-0 items-center gap-2 text-xs text-foreground">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", status.dot)} />
          {status.label}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" title={target.url || target.error}>
          {target.url || target.error}
        </span>
        <Checkbox
          checked={session.autoReconnect}
          onChange={(event) => sockets.setAutoReconnect(tabId, event.target.checked)}
        >
          Auto-reconnect
        </Checkbox>
        {isIdle ? (
          <Button size="sm" disabled={Boolean(target.error)} onClick={() => sockets.connect(tabId)}>Connect</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => sockets.disconnect(tabId)}>Disconnect</Button>
        )}
      </Toolbar>

      {unsentHeaders.length > 0 && (
        <Notice>
          A browser can only set Sec-WebSocket-Protocol on a WebSocket. Not sent from here: {unsentHeaders.join(", ")}. The desktop app sends every header.
        </Notice>
      )}

      <MessageLog entries={session.entries} dropped={session.dropped} />

      <div className="flex shrink-0 items-stretch gap-2 border-t border-border p-3">
        <Textarea
          value={session.draft}
          onChange={(event) => sockets.setDraft(tabId, event.target.value)}
          onKeyDown={handleComposerKey}
          placeholder={isOpen ? `Message (${shortcutLabel("Enter")} to send)` : "Connect to send messages"}
          aria-label="Message"
          disabled={!isOpen}
          className="h-16 flex-1"
        />
        <div className="flex shrink-0 flex-col justify-between">
          <Button size="sm" disabled={!canSend} onClick={() => sockets.sendMessage(tabId)}>Send</Button>
          <Button variant="ghost" size="sm" disabled={session.entries.length === 0} onClick={() => sockets.clearLog(tabId)}>
            Clear
          </Button>
        </div>
      </div>
    </Panel>
  )
}
