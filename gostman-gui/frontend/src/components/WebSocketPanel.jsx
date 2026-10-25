import { memo, useLayoutEffect, useMemo, useRef } from "react"
import { ArrowDown, ArrowUp, Copy, Info, Radio, Trash2, TriangleAlert } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, Panel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { VariableInput, VariableTextarea } from "./VariableInput"
import { shortcutLabel } from "../lib/platform"
import { PROTOCOL_OPTIONS, protocolOf, usesGraphQL } from "../lib/realtime/protocols"
import { readSavedMessages, removeMessage, saveMessage } from "../lib/realtime/savedMessages"
import { SOCKET_TEXT } from "../lib/socketText"
import { DIALOG_TEXT } from "../lib/dialogText"
import { useAppStore } from "../store/appStore"
import {
  ENTRY_ERROR,
  ENTRY_INFO,
  ENTRY_RECEIVED,
  ENTRY_SENT,
  ENTRY_WARNING,
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
const HANDSHAKE_FIELD = "flex min-w-[12rem] flex-1 items-center gap-2"
const HANDSHAKE_LABEL = "shrink-0 text-xs text-muted-foreground"
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })

const STATUS_VIEWS = {
  [SOCKET_IDLE]: { label: SOCKET_TEXT.statuses.idle, dot: "bg-muted-foreground" },
  [SOCKET_CONNECTING]: { label: SOCKET_TEXT.statuses.connecting, dot: "bg-warning" },
  [SOCKET_OPEN]: { label: SOCKET_TEXT.statuses.open, dot: "bg-success" },
  [SOCKET_WAITING]: { label: SOCKET_TEXT.statuses.waiting, dot: "bg-warning" },
}

const ENTRY_VIEWS = {
  [ENTRY_SENT]: { icon: ArrowUp, label: SOCKET_TEXT.entries.sent, tone: "text-info" },
  [ENTRY_RECEIVED]: { icon: ArrowDown, label: SOCKET_TEXT.entries.received, tone: "text-success" },
  [ENTRY_INFO]: { icon: Info, label: SOCKET_TEXT.entries.info, tone: "text-muted-foreground" },
  [ENTRY_WARNING]: { icon: TriangleAlert, label: SOCKET_TEXT.entries.warning, tone: "text-warning" },
  [ENTRY_ERROR]: { icon: TriangleAlert, label: SOCKET_TEXT.entries.error, tone: "text-destructive" },
}

function sizeNote(entry) {
  if (entry.byteCount !== undefined) return SOCKET_TEXT.binary(entry.byteCount)
  if (entry.fullLength !== undefined) return SOCKET_TEXT.truncated(entry.text.length, entry.fullLength)
  return ""
}

const entryNote = (entry) => [entry.label, sizeNote(entry)].filter(Boolean).join(" · ")

const LogEntry = memo(function LogEntry({ entry }) {
  const { icon: Icon, label, tone } = ENTRY_VIEWS[entry.kind]
  const note = entryNote(entry)
  const isMessage = entry.kind === ENTRY_SENT || entry.kind === ENTRY_RECEIVED
  const copy = () => navigator.clipboard.writeText(entry.text).catch(() => {})

  return (
    <li className="group grid grid-cols-[3.75rem_1rem_minmax(0,1fr)_1.5rem] items-start gap-2 border-b border-border px-3 py-1">
      <time className="font-mono text-2xs leading-6 text-muted-foreground">{TIME_FORMAT.format(entry.time)}</time>
      <Icon aria-label={label} className={cn("mt-[5px] h-3.5 w-3.5", tone)} />
      <div className="min-w-0 py-0.5">
        {note && <p className="text-2xs leading-5 text-muted-foreground">{note}</p>}
        <pre className={cn("whitespace-pre-wrap break-all font-mono text-xs leading-5", isMessage ? "text-foreground" : tone)}>{entry.text}</pre>
      </div>
      {isMessage && (
        <IconButton
          label={SOCKET_TEXT.copy}
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
      {dropped > 0 && <Notice>{SOCKET_TEXT.dropped(dropped, LOG_LIMIT)}</Notice>}
      {entries.length === 0 && (
        <EmptyState icon={Radio} title={SOCKET_TEXT.emptyTitle} description={SOCKET_TEXT.emptyDescription} />
      )}
      <ul aria-label={SOCKET_TEXT.log}>
        {entries.map((entry) => <LogEntry key={entry.id} entry={entry} />)}
      </ul>
    </div>
  )
}

function ProtocolPicker({ request, disabled, onUpdateRequest }) {
  if (usesGraphQL(request)) return <span className="shrink-0 text-xs text-muted-foreground">{SOCKET_TEXT.graphql}</span>
  return (
    <Select
      aria-label={SOCKET_TEXT.protocol}
      className="w-28 shrink-0"
      value={request.socketProtocol || ""}
      disabled={disabled}
      onChange={(event) => onUpdateRequest({ socketProtocol: event.target.value })}
    >
      {PROTOCOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Select>
  )
}

function HandshakeBar({ request, disabled, onUpdateRequest }) {
  const options = request.options || {}
  const update = (patch) => onUpdateRequest({ options: { ...options, ...patch } })
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2">
      <label className={HANDSHAKE_FIELD}>
        <span className={HANDSHAKE_LABEL}>{SOCKET_TEXT.socketIoPath}</span>
        <VariableInput
          placeholder={SOCKET_TEXT.socketIoPathPlaceholder}
          value={options.socketIoPath || ""}
          fileReads={false}
          disabled={disabled}
          className="font-mono"
          onChange={(event) => update({ socketIoPath: event.target.value })}
        />
      </label>
      <label className={cn(HANDSHAKE_FIELD, "flex-[3]")} title={SOCKET_TEXT.socketIoAuthNote}>
        <span className={HANDSHAKE_LABEL}>{SOCKET_TEXT.socketIoAuth}</span>
        <VariableInput
          placeholder={SOCKET_TEXT.socketIoAuthPlaceholder}
          value={options.socketIoAuth || ""}
          fileReads={false}
          disabled={disabled}
          className="font-mono"
          onChange={(event) => update({ socketIoAuth: event.target.value })}
        />
      </label>
    </div>
  )
}

function SubscribeBar({ tabId, session, isOpen, sockets }) {
  const submit = (event) => {
    event.preventDefault()
    sockets.subscribe(tabId)
  }
  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
      <Input
        aria-label={SOCKET_TEXT.filter}
        placeholder={SOCKET_TEXT.filter}
        value={session.filter}
        onChange={(event) => sockets.setFilter(tabId, event.target.value)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!isOpen || session.filter.trim() === ""}>{SOCKET_TEXT.subscribe}</Button>
    </form>
  )
}

function SavedMessages({ tabId, request, session, sockets, onUpdateRequest }) {
  const showPrompt = useAppStore((state) => state.showPrompt)
  const messages = useMemo(() => readSavedMessages(request.socketMessages), [request.socketMessages])
  const current = messages.find((message) => message.body === session.draft && message.target === session.draftTarget)
  const hasDraft = session.draft !== "" || session.draftTarget.trim() !== ""

  const choose = (name) => {
    const message = messages.find((entry) => entry.name === name)
    if (message) sockets.loadMessage(tabId, message)
  }

  const save = () => showPrompt(SOCKET_TEXT.saveTitle, SOCKET_TEXT.saveMessage, current?.name || "", "", (name) => {
    const trimmed = name?.trim()
    if (trimmed) onUpdateRequest({ socketMessages: saveMessage(request.socketMessages, { name: trimmed, body: session.draft, target: session.draftTarget }) })
  }, DIALOG_TEXT.save)

  const remove = () => onUpdateRequest({ socketMessages: removeMessage(request.socketMessages, current.name) })

  return (
    <>
      <Select
        aria-label={SOCKET_TEXT.saved}
        className="w-48 shrink-0"
        value={current?.name || ""}
        disabled={messages.length === 0}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">{messages.length === 0 ? SOCKET_TEXT.noSaved : SOCKET_TEXT.savedPlaceholder}</option>
        {messages.map((message) => <option key={message.name} value={message.name}>{message.name}</option>)}
      </Select>
      {current && <IconButton label={SOCKET_TEXT.remove} icon={Trash2} onClick={remove} />}
      <Button size="sm" variant="outline" disabled={!hasDraft} onClick={save}>{SOCKET_TEXT.save}</Button>
    </>
  )
}

export function WebSocketPanel({ tabId, request, variables, sockets, onUpdateRequest }) {
  const session = useSocketStore(selectSession(tabId))
  const { url, headers } = request
  const target = useMemo(() => resolveSocketTarget({ url, headers }, variables), [url, headers, variables])
  const unsentHeaders = target.error ? [] : sockets.unsentHeaders(target.headers)
  const protocol = protocolOf(request)
  const status = STATUS_VIEWS[session.status]
  const isIdle = session.status === SOCKET_IDLE
  const isOpen = session.status === SOCKET_OPEN
  const canSend = isOpen && (session.draft !== "" || (Boolean(protocol.targetLabel) && session.draftTarget.trim() !== ""))

  const handleComposerKey = (event) => {
    if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return
    event.preventDefault()
    event.stopPropagation()
    sockets.sendMessage(tabId)
  }

  return (
    <Panel>
      <Toolbar className="max-sm:h-auto max-sm:min-h-10 max-sm:flex-wrap max-sm:py-1.5">
        <span className="flex shrink-0 items-center gap-2 text-xs text-foreground">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", status.dot)} />
          {status.label}
        </span>
        <ProtocolPicker request={request} disabled={!isIdle} onUpdateRequest={onUpdateRequest} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground max-sm:order-last max-sm:basis-full" title={target.url || target.error}>
          {target.url || target.error}
        </span>
        <Checkbox
          checked={session.autoReconnect}
          onChange={(event) => sockets.setAutoReconnect(tabId, event.target.checked)}
        >
          {SOCKET_TEXT.autoReconnect}
        </Checkbox>
      </Toolbar>

      {unsentHeaders.length > 0 && (
        <Notice>{SOCKET_TEXT.unsentHeaders(unsentHeaders)}</Notice>
      )}

      {protocol.hasHandshake && <HandshakeBar request={request} disabled={!isIdle} onUpdateRequest={onUpdateRequest} />}

      {protocol.canSubscribe && <SubscribeBar tabId={tabId} session={session} isOpen={isOpen} sockets={sockets} />}

      <MessageLog entries={session.entries} dropped={session.dropped} />

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 pt-3">
        {protocol.targetLabel && (
          <VariableInput
            aria-label={protocol.targetLabel}
            placeholder={protocol.targetLabel}
            value={session.draftTarget}
            fileReads={false}
            onChange={(event) => sockets.setDraftTarget(tabId, event.target.value)}
          />
        )}
        <SavedMessages
          tabId={tabId}
          request={request}
          session={session}
          sockets={sockets}
          onUpdateRequest={onUpdateRequest}
        />
      </div>

      <div className="flex shrink-0 items-stretch gap-2 p-3">
        <VariableTextarea
          value={session.draft}
          fileReads={false}
          onChange={(event) => sockets.setDraft(tabId, event.target.value)}
          onKeyDown={handleComposerKey}
          placeholder={isOpen ? SOCKET_TEXT.composer(shortcutLabel("Enter")) : SOCKET_TEXT.composerClosed}
          aria-label={SOCKET_TEXT.message}
          disabled={!isOpen}
          className="h-16 flex-1"
        />
        <div className="flex shrink-0 flex-col justify-between">
          <Button size="sm" disabled={!canSend} onClick={() => sockets.sendMessage(tabId)}>{SOCKET_TEXT.send}</Button>
          <Button variant="ghost" size="sm" disabled={session.entries.length === 0} onClick={() => sockets.clearLog(tabId)}>
            {SOCKET_TEXT.clear}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
