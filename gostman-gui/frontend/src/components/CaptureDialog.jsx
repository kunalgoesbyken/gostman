import { useMemo, useState } from "react"
import { AlertTriangle, FileDigit, FileText, Info, List, Play, Radio, Square, X } from "lucide-react"
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
import { DesktopOnly } from "./DesktopOnly"
import { LocalAddress } from "./LocalAddress"
import { MethodTag } from "./MethodTag"
import { isSavable, suggestedFolderName } from "../lib/captureConversion"
import { NEW_FOLDER, useCaptureStore } from "../lib/captureSession"
import { CAPTURE_TEXT } from "../lib/captureText"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { formatSize } from "../lib/dataUtils"
import { parseJsonBody, statusVariant } from "../lib/response"
import { RESPONSE_TEXT } from "../lib/responseText"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

const PATH_SEPARATOR = " / "
const ENCODING_BASE64 = "base64"
const ROW_HEIGHT_PX = 28
const COLUMNS = "grid min-w-0 flex-1 grid-cols-[4.5rem_3.5rem_minmax(0,1fr)_2.75rem_4.5rem_4.5rem] items-center gap-2"
const CELL = "truncate font-mono text-xs"
const SIDE_REQUEST = "request"
const SIDE_RESPONSE = "response"
const PART_HEADERS = "headers"
const PART_BODY = "body"

const SIDES = [
  { value: SIDE_REQUEST, label: CAPTURE_TEXT.sides.request },
  { value: SIDE_RESPONSE, label: CAPTURE_TEXT.sides.response },
]

const HEADER_COLUMNS = [
  { header: RESPONSE_TEXT.columns.name, key: "key", width: "w-1/3", cellClassName: "text-foreground" },
  { header: RESPONSE_TEXT.columns.value, key: "value" },
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
        placeholder={CAPTURE_TEXT.upstreamPlaceholder}
        aria-label={CAPTURE_TEXT.upstreamLabel}
        spellCheck={false}
        disabled={isRunning}
        onChange={(event) => actions.setUpstream(event.target.value)}
        className="font-mono"
      />
      <Input
        type="number"
        min={1}
        value={port || ""}
        placeholder={CAPTURE_TEXT.port}
        aria-label={CAPTURE_TEXT.port}
        title={CAPTURE_TEXT.portTitle}
        disabled={isRunning}
        onChange={(event) => actions.setPort(event.target.value)}
        className="w-20 shrink-0 font-mono"
      />
      {isRunning ? (
        <Button variant="destructive" size="sm" onClick={actions.stop}>
          <Square />
          {CAPTURE_TEXT.stop}
        </Button>
      ) : (
        <Button size="sm" disabled={isStarting || upstream.trim() === ""} onClick={actions.start}>
          <Play />
          {CAPTURE_TEXT.start}
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
      {exchange.status || CAPTURE_TEXT.failed}
    </Badge>
  )
}

function ExchangeRow({ exchange, isChecked, isCurrent, onToggle, onInspect }) {
  return (
    <div className={cn("flex h-7 items-center gap-2 border-b border-border px-3", isCurrent && "bg-accent")}>
      <Checkbox label={CAPTURE_TEXT.selectExchange(titleOf(exchange))} checked={isChecked} onChange={() => onToggle(exchange.id)} />
      <button type="button" aria-current={isCurrent} onClick={() => onInspect(exchange.id)} className={cn(COLUMNS, "h-full text-left")}>
        <span className={`${CELL} text-muted-foreground`}>{new Date(exchange.time).toLocaleTimeString([], { hour12: false })}</span>
        <MethodTag method={exchange.method} />
        <span title={exchange.path} className={`${CELL} text-foreground`}>{exchange.path}</span>
        <StatusBadge exchange={exchange} />
        <span className={`${CELL} text-right text-muted-foreground`}>{CAPTURE_TEXT.duration(exchange.durationMs)}</span>
        <span className={`${CELL} text-right text-muted-foreground`}>{formatSize(exchange.response.size)}</span>
      </button>
    </div>
  )
}

function ListHeader({ isAllChecked, onToggleAll }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3">
      <Checkbox label={CAPTURE_TEXT.selectAll} checked={isAllChecked} onChange={onToggleAll} />
      <div className={COLUMNS}>
        <SectionLabel className="truncate">{CAPTURE_TEXT.columns.time}</SectionLabel>
        <SectionLabel className="truncate">{CAPTURE_TEXT.columns.method}</SectionLabel>
        <SectionLabel className="truncate">{CAPTURE_TEXT.columns.path}</SectionLabel>
        <SectionLabel className="truncate">{CAPTURE_TEXT.columns.status}</SectionLabel>
        <SectionLabel className="truncate text-right">{CAPTURE_TEXT.columns.duration}</SectionLabel>
        <SectionLabel className="truncate text-right">{CAPTURE_TEXT.columns.size}</SectionLabel>
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
      <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={CAPTURE_TEXT.destinationLabel}>
        <option value={NEW_FOLDER}>{existing ? suggestedName : CAPTURE_TEXT.newFolder(suggestedName)}</option>
        <option value={ROOT_ID}>{TREE_TEXT.topLevel}</option>
        {others.map(({ folder, path }) => (
          <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
        ))}
      </Select>
    </div>
  )
}

function MessageBody({ message }) {
  if (!message.body) return <EmptyState icon={FileText} title={CAPTURE_TEXT.noBody} />
  if (message.bodyEncoding === ENCODING_BASE64) {
    return <EmptyState icon={FileDigit} title={CAPTURE_TEXT.binaryBody(formatSize(message.size))} description={message.contentType} />
  }
  return <pre className="whitespace-pre-wrap p-3 font-mono text-xs text-foreground [overflow-wrap:anywhere]">{readable(message.body)}</pre>
}

function MessageHeaders({ headers }) {
  if (headers.length === 0) return <EmptyState icon={List} title={RESPONSE_TEXT.noHeadersTitle} />
  return <DataTable columns={HEADER_COLUMNS} rows={headers} />
}

function ExchangeDetail({ exchange, actions }) {
  const [side, setSide] = useState(SIDE_RESPONSE)
  const [part, setPart] = useState(PART_BODY)
  const message = exchange[side]
  const parts = [
    { value: PART_BODY, label: CAPTURE_TEXT.body },
    { value: PART_HEADERS, label: CAPTURE_TEXT.headersCount(message.headers.length) },
  ]

  return (
    <section aria-label={CAPTURE_TEXT.selectedExchange} className="flex h-64 shrink-0 flex-col border-t border-border">
      <Toolbar>
        <SegmentedControl label={CAPTURE_TEXT.message} options={SIDES} value={side} onChange={setSide} />
        <SegmentedControl label={CAPTURE_TEXT.messageSection} options={parts} value={part} onChange={setPart} />
        <span title={exchange.url} className={`${CELL} min-w-0 flex-1 text-right text-muted-foreground`}>{exchange.url}</span>
        <Button variant="outline" size="sm" disabled={!isSavable(exchange)} onClick={() => actions.openAsRequest(exchange)}>
          {CAPTURE_TEXT.saveAsRequest}
        </Button>
        <IconButton label={CAPTURE_TEXT.closeDetails} icon={X} onClick={actions.closeDetail} />
      </Toolbar>
      {exchange.error && <Notice tone="destructive" icon={AlertTriangle}>{exchange.error}</Notice>}
      {exchange.upgraded && <Notice icon={Info}>{CAPTURE_TEXT.upgraded}</Notice>}
      {exchange.interrupted && <Notice tone="warning" icon={AlertTriangle}>{CAPTURE_TEXT.interrupted}</Notice>}
      {message.truncated && <Notice tone="warning" icon={AlertTriangle}>{CAPTURE_TEXT.truncated}</Notice>}
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
      <Notice icon={Info}>{CAPTURE_TEXT.limitation}</Notice>
      {failure && <Notice tone="destructive" icon={AlertTriangle} role="alert">{failure}</Notice>}
      <Toolbar>
        <SectionLabel>{CAPTURE_TEXT.exchanges}</SectionLabel>
        <TabCount>{shown.length}</TabCount>
        <Input
          type="search"
          value={query}
          placeholder={CAPTURE_TEXT.filterPlaceholder}
          aria-label={CAPTURE_TEXT.filterLabel}
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
          {CAPTURE_TEXT.saveSelected}
        </Button>
        <Button variant="ghost" size="sm" disabled={log.length === 0} onClick={clear}>{CAPTURE_TEXT.clear}</Button>
      </Toolbar>
      {log.length === 0 ? (
        <div className="min-h-0 flex-1">
          <EmptyState
            icon={Radio}
            title={CAPTURE_TEXT.emptyTitle}
            description={isRunning ? CAPTURE_TEXT.listening(address) : CAPTURE_TEXT.idleHint}
          />
        </div>
      ) : (
        <>
          <ListHeader isAllChecked={isAllChecked} onToggleAll={toggleAll} />
          <VirtualList
            aria-label={CAPTURE_TEXT.listLabel}
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

const CAPTURE_WINDOW = { id: "capture", width: 896, height: 640, minWidth: 560, minHeight: 400 }

export function CaptureDialog({ folders, requests, actions }) {
  const isRunning = useCaptureStore((state) => state.isRunning)
  const address = useCaptureStore((state) => state.address)

  return (
    <Dialog label={CAPTURE_TEXT.title} size={actions.isAvailable ? "lg" : "sm"} className={actions.isAvailable ? "h-[40rem] max-w-4xl" : undefined} floating={actions.isAvailable ? CAPTURE_WINDOW : undefined} onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{CAPTURE_TEXT.title}</DialogTitle>
        {isRunning && <Badge variant="success">{CAPTURE_TEXT.running}</Badge>}
        {isRunning && <LocalAddress address={address} />}
      </DialogHeader>
      {actions.isAvailable ? (
        <CapturePanel folders={folders} requests={requests} actions={actions} />
      ) : (
        <DesktopOnly title={CAPTURE_TEXT.desktopOnly} description={CAPTURE_TEXT.webNotice} />
      )}
    </Dialog>
  )
}
