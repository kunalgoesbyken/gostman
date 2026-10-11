import { useMemo, useState } from "react"
import { AlertTriangle, FileDigit, FileText, Info, List, MonitorDown, Play, Radio, Square, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { DataTable } from "./ui/dataTable"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { TabCount } from "./ui/tabs"
import { VirtualList } from "./ui/VirtualList"
import { LocalAddress } from "./LocalAddress"
import { MethodTag } from "./MethodTag"
import { isSavable, suggestedFolderName } from "../lib/captureConversion"
import { NEW_FOLDER, useCaptureStore } from "../lib/captureSession"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { formatSize } from "../lib/dataUtils"
import { parseJsonBody, statusVariant } from "../lib/response"
import { cn } from "../lib/utils"

const PATH_SEPARATOR = " / "
const WEB_NOTICE = "Capturing traffic needs the desktop app, which can listen on a local port and forward to your API."
const LIMITATION = "Point your app at the local address instead of the API. An app whose base URL cannot be changed is not captured."
const UPSTREAM_PLACEHOLDER = "API to forward to, for example https://api.example.com"
const IDLE_HINT = "Enter the API your app talks to, then start the capture."
const FAILED_LABEL = "ERR"
const ENCODING_BASE64 = "base64"
const ROW_HEIGHT_PX = 28
const COLUMNS = "grid min-w-0 flex-1 grid-cols-[4.5rem_3.5rem_minmax(0,1fr)_2.75rem_4.5rem_4.5rem] items-center gap-2"
const CELL = "truncate font-mono text-xs"
const SIDE_REQUEST = "request"
const SIDE_RESPONSE = "response"
const PART_HEADERS = "headers"
const PART_BODY = "body"

const SIDES = [
  { value: SIDE_REQUEST, label: "Request" },
  { value: SIDE_RESPONSE, label: "Response" },
]

const HEADER_COLUMNS = [
  { header: "Name", key: "key", width: "w-1/3", cellClassName: "text-foreground" },
  { header: "Value", key: "value" },
]

const titleOf = (exchange) => `${exchange.method} ${exchange.path}`

const matches = (needle) => (exchange) => `${titleOf(exchange)} ${exchange.status}`.toLowerCase().includes(needle)

function readable(body) {
  const parsed = parseJsonBody(body)
  return parsed === null ? body : JSON.stringify(parsed, null, 2)
}

function CaptureControls({ capture, actions }) {
  const { isRunning, isStarting, upstream, port } = capture
  return (
    <Toolbar>
      <Input
        value={upstream}
        placeholder={UPSTREAM_PLACEHOLDER}
        aria-label="API to forward to"
        spellCheck={false}
        disabled={isRunning}
        onChange={(event) => actions.setUpstream(event.target.value)}
        className="font-mono"
      />
      <Input
        type="number"
        min={1}
        value={port || ""}
        placeholder="Port"
        aria-label="Port"
        title="Port on 127.0.0.1"
        disabled={isRunning}
        onChange={(event) => actions.setPort(event.target.value)}
        className="w-20 shrink-0 font-mono"
      />
      {isRunning ? (
        <Button variant="destructive" size="sm" onClick={actions.stop}>
          <Square />
          Stop
        </Button>
      ) : (
        <Button size="sm" disabled={isStarting || upstream.trim() === ""} onClick={actions.start}>
          <Play />
          Start
        </Button>
      )}
    </Toolbar>
  )
}

function StatusBadge({ exchange }) {
  return (
    <Badge
      variant={exchange.error ? "serverError" : statusVariant({ statusCode: exchange.status })}
      title={exchange.error || undefined}
      className="justify-self-start font-mono"
    >
      {exchange.status || FAILED_LABEL}
    </Badge>
  )
}

function ExchangeRow({ exchange, isChecked, isCurrent, onToggle, onInspect }) {
  return (
    <div className={cn("flex h-7 items-center gap-2 border-b border-border px-3", isCurrent && "bg-accent")}>
      <Checkbox label={`Select ${titleOf(exchange)}`} checked={isChecked} onChange={() => onToggle(exchange.id)} />
      <button type="button" aria-current={isCurrent} onClick={() => onInspect(exchange.id)} className={cn(COLUMNS, "h-full text-left")}>
        <span className={`${CELL} text-muted-foreground`}>{new Date(exchange.time).toLocaleTimeString([], { hour12: false })}</span>
        <MethodTag method={exchange.method} />
        <span title={exchange.path} className={`${CELL} text-foreground`}>{exchange.path}</span>
        <StatusBadge exchange={exchange} />
        <span className={`${CELL} text-right text-muted-foreground`}>{exchange.durationMs} ms</span>
        <span className={`${CELL} text-right text-muted-foreground`}>{formatSize(exchange.response.size)}</span>
      </button>
    </div>
  )
}

function ListHeader({ isAllChecked, onToggleAll }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
      <Checkbox label="Select every exchange shown" checked={isAllChecked} onChange={onToggleAll} />
      <div className={COLUMNS}>
        <SectionLabel className="truncate">Time</SectionLabel>
        <SectionLabel className="truncate">Method</SectionLabel>
        <SectionLabel className="truncate">Path</SectionLabel>
        <SectionLabel className="truncate">Status</SectionLabel>
        <SectionLabel className="truncate text-right">Duration</SectionLabel>
        <SectionLabel className="truncate text-right">Size</SectionLabel>
      </div>
    </div>
  )
}

function Destination({ value, onChange, folders, requests, suggestedName }) {
  const existing = folders.find((folder) => !folder.parentId && folder.name === suggestedName)
  const others = useMemo(
    () => listFolders(buildCollectionTree(folders, requests)).filter(({ folder }) => folder.id !== existing?.id),
    [folders, requests, existing]
  )
  return (
    <div className="w-48 shrink-0">
      <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Folder to save into">
        <option value={NEW_FOLDER}>{existing ? suggestedName : `New folder ${suggestedName}`}</option>
        <option value={ROOT_ID}>Top level</option>
        {others.map(({ folder, path }) => (
          <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
        ))}
      </Select>
    </div>
  )
}

function MessageBody({ message }) {
  if (!message.body) return <EmptyState icon={FileText} title="No body" />
  if (message.bodyEncoding === ENCODING_BASE64) {
    return <EmptyState icon={FileDigit} title={`Binary body, ${formatSize(message.size)}`} description={message.contentType} />
  }
  return <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground [overflow-wrap:anywhere]">{readable(message.body)}</pre>
}

function MessageHeaders({ headers }) {
  if (headers.length === 0) return <EmptyState icon={List} title="No headers" />
  return <DataTable columns={HEADER_COLUMNS} rows={headers} />
}

function ExchangeDetail({ exchange, actions }) {
  const [side, setSide] = useState(SIDE_RESPONSE)
  const [part, setPart] = useState(PART_BODY)
  const message = exchange[side]
  const parts = [
    { value: PART_BODY, label: "Body" },
    { value: PART_HEADERS, label: `Headers (${message.headers.length})` },
  ]

  return (
    <section aria-label="Selected exchange" className="flex h-64 shrink-0 flex-col border-t border-border">
      <Toolbar>
        <SegmentedControl label="Message" options={SIDES} value={side} onChange={setSide} />
        <SegmentedControl label="Message section" options={parts} value={part} onChange={setPart} />
        <span title={exchange.url} className={`${CELL} min-w-0 flex-1 text-right text-muted-foreground`}>{exchange.url}</span>
        <Button variant="outline" size="sm" disabled={!isSavable(exchange)} onClick={() => actions.openAsRequest(exchange)}>
          Save as request
        </Button>
        <IconButton label="Close details" icon={X} onClick={actions.closeDetail} />
      </Toolbar>
      {exchange.error && <Notice tone="destructive" icon={AlertTriangle}>{exchange.error}</Notice>}
      {exchange.upgraded && <Notice icon={Info}>This call switched to a WebSocket. Its frames are forwarded but not recorded.</Notice>}
      {exchange.interrupted && <Notice tone="warning" icon={AlertTriangle}>The response ended before it was complete.</Notice>}
      {message.truncated && <Notice tone="warning" icon={AlertTriangle}>This body was forwarded whole, but only its first 2 MB are kept here.</Notice>}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {part === PART_BODY ? <MessageBody message={message} /> : <MessageHeaders headers={message.headers} />}
      </div>
    </section>
  )
}

function CapturePanel({ folders, requests, actions }) {
  const capture = useCaptureStore()
  const [query, setQuery] = useState("")
  const [checked, setChecked] = useState(() => new Set())
  const [target, setTarget] = useState(NEW_FOLDER)

  const { log, detail, isRunning, address, failure } = capture
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? log.filter(matches(needle)) : log
  }, [log, query])
  const selected = useMemo(() => log.filter((exchange) => checked.has(exchange.id)), [log, checked])
  const isAllChecked = shown.length > 0 && shown.every((exchange) => checked.has(exchange.id))

  const toggle = (id) => setChecked((current) => {
    const next = new Set(current)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const toggleAll = () => setChecked(isAllChecked ? new Set() : new Set(shown.map((exchange) => exchange.id)))
  const clear = () => {
    setChecked(new Set())
    actions.clear()
  }

  return (
    <>
      <CaptureControls capture={capture} actions={actions} />
      <Notice icon={Info}>{LIMITATION}</Notice>
      {failure && <Notice tone="destructive" icon={AlertTriangle} role="alert">{failure}</Notice>}
      <Toolbar>
        <SectionLabel>Exchanges</SectionLabel>
        <TabCount>{shown.length}</TabCount>
        <Input
          type="search"
          value={query}
          placeholder="Filter by method, path or status"
          aria-label="Filter exchanges"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Destination
          value={target}
          onChange={setTarget}
          folders={folders}
          requests={requests}
          suggestedName={suggestedFolderName(selected.length > 0 ? selected : log)}
        />
        <Button variant="outline" size="sm" disabled={selected.length === 0} onClick={() => actions.saveToFolder(selected.map((exchange) => exchange.id), target)}>
          Save selected to folder
        </Button>
        <Button variant="ghost" size="sm" disabled={log.length === 0} onClick={clear}>Clear</Button>
      </Toolbar>
      {log.length === 0 ? (
        <div className="min-h-0 flex-1">
          <EmptyState
            icon={Radio}
            title="No calls captured yet"
            description={isRunning ? `Calls your app sends to ${address} appear here.` : IDLE_HINT}
          />
        </div>
      ) : (
        <>
          <ListHeader isAllChecked={isAllChecked} onToggleAll={toggleAll} />
          <VirtualList
            aria-label="Captured exchanges"
            items={shown}
            rowHeight={ROW_HEIGHT_PX}
            className="min-h-0 flex-1"
            renderRow={(exchange) => (
              <ExchangeRow
                key={exchange.id}
                exchange={exchange}
                isChecked={checked.has(exchange.id)}
                isCurrent={exchange.id === detail?.id}
                onToggle={toggle}
                onInspect={actions.inspect}
              />
            )}
          />
        </>
      )}
      {detail && <ExchangeDetail key={detail.id} exchange={detail} actions={actions} />}
    </>
  )
}

export function CaptureDialog({ folders, requests, actions }) {
  const isRunning = useCaptureStore((state) => state.isRunning)
  const address = useCaptureStore((state) => state.address)

  return (
    <Dialog label="Capture traffic" size="lg" className="h-[40rem] max-w-4xl" onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>Capture traffic</DialogTitle>
        {isRunning && <Badge variant="success">Running</Badge>}
        {isRunning && <LocalAddress address={address} />}
      </DialogHeader>
      {actions.isAvailable ? (
        <CapturePanel folders={folders} requests={requests} actions={actions} />
      ) : (
        <div className="min-h-0 flex-1">
          <EmptyState icon={MonitorDown} title="Available in the desktop app" description={WEB_NOTICE} />
        </div>
      )}
    </Dialog>
  )
}
