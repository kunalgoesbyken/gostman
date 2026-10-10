import { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import {
  AlertTriangle, Braces, Check, ChevronDown, ChevronUp, Code, Cookie, Copy, Download, Eye,
  FileDigit, FileText, FileX, List, Loader2, Maximize2, Minimize2, Minus, Scissors,
} from "lucide-react"
import { Badge } from "./ui/badge"
import { DataTable } from "./ui/dataTable"
import { EmptyState } from "./ui/emptyState"
import { formatSize } from "../lib/dataUtils"
import {
  BODY_KINDS, ERROR_TITLES, bodyBytes, bodyKind, mimeType, parseJsonBody, statusVariant, textBody,
} from "../lib/response"

const DEFAULT_PANEL_HEIGHT = 40
const MIN_PANEL_HEIGHT = 15
const MAX_PANEL_HEIGHT = 85
const COLLAPSED_HEIGHT = 48
const COPIED_NOTICE_MS = 2000
const TEXT_DISPLAY_LIMIT = 500_000
const JSON_EXPANDED_DEPTH = 2

const TABS = [
  { id: 'body', label: 'Body', icon: Code },
  { id: 'headers', label: 'Headers', icon: List },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
]

const VIEWS = {
  pretty: { label: 'Pretty', icon: Braces },
  raw: { label: 'Raw', icon: FileText },
  preview: { label: 'Preview', icon: Eye },
}

const MEDIA_KINDS = [BODY_KINDS.IMAGE, BODY_KINDS.PDF, BODY_KINDS.AUDIO, BODY_KINDS.VIDEO]

const ICON_BUTTON_CLASS = "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"

const HEADER_COLUMNS = [
  { header: 'Name', key: 'key', width: 'w-2/5', cellClassName: 'font-medium text-primary/80 align-top whitespace-nowrap' },
  { header: 'Value', key: 'value', cellClassName: 'break-all' },
]

const flagCell = (isSet) => (
  <div className="flex justify-center">
    {isSet
      ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
      : <Minus className="h-3.5 w-3.5 text-muted-foreground/30" strokeWidth={2} />}
  </div>
)

const COOKIE_COLUMNS = [
  { header: 'Name', key: 'name', cellClassName: 'font-medium text-primary/80 whitespace-nowrap', nowrap: true },
  { header: 'Value', render: (cookie) => <span className="max-w-[180px] truncate" title={cookie.value}>{cookie.value || '—'}</span> },
  { header: 'Domain', cellClassName: 'whitespace-nowrap', render: (cookie) => cookie.domain || '—' },
  { header: 'Path', cellClassName: 'whitespace-nowrap', render: (cookie) => cookie.path || '/' },
  { header: 'Expires', cellClassName: 'whitespace-nowrap', render: (cookie) => cookie.expires || 'Session' },
  { header: 'Secure', render: (cookie) => flagCell(cookie.secure) },
  { header: 'HttpOnly', render: (cookie) => flagCell(cookie.httpOnly) },
]

function viewsFor(kind, isText, isJson) {
  if (isJson) return ['pretty', 'raw']
  if (kind === BODY_KINDS.HTML) return ['raw', 'preview']
  if (kind === BODY_KINDS.TEXT) return ['raw']
  if (!MEDIA_KINDS.includes(kind)) return []
  return isText ? ['preview', 'raw'] : ['preview']
}

function displayableText(text) {
  if (text.length <= TEXT_DISPLAY_LIMIT) return text
  const lastCode = text.charCodeAt(TEXT_DISPLAY_LIMIT - 1)
  const endsInsideSurrogatePair = lastCode >= 0xd800 && lastCode <= 0xdbff
  return text.slice(0, endsInsideSurrogatePair ? TEXT_DISPLAY_LIMIT - 1 : TEXT_DISPLAY_LIMIT)
}

function useObjectUrl(response) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([bodyBytes(response)], { type: mimeType(response) }))
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [response])

  return url
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
  }, [text])

  return (
    <button onClick={handleCopy} className={ICON_BUTTON_CLASS} title={copied ? "Copied" : "Copy body"}>
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function TabButton({ id, label, icon: Icon, count, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && (
        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

function ViewButton({ view, active, onClick }) {
  const { label, icon: Icon } = VIEWS[view]
  return (
    <button
      onClick={() => onClick(view)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function ResizableDivider({ onDrag, isDragging, onDoubleClick }) {
  return (
    <div
      className={`group relative h-1.5 cursor-row-resize transition-colors hover:bg-primary/20 ${isDragging ? 'bg-primary/30' : 'bg-transparent'}`}
      onMouseDown={onDrag}
      onDoubleClick={onDoubleClick}
    >
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className={`h-1 w-16 rounded-full ${isDragging ? 'bg-primary' : 'bg-border'}`} />
      </div>
    </div>
  )
}

function Notice({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function TextBody({ text }) {
  const shown = displayableText(text)
  return (
    <>
      {shown.length < text.length && (
        <Notice icon={Scissors}>
          Showing the first {formatSize(TEXT_DISPLAY_LIMIT)} of this body. Download it to see everything.
        </Notice>
      )}
      <pre className="whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed text-foreground/90">{shown}</pre>
    </>
  )
}

function BinaryBody({ response }) {
  return (
    <EmptyState
      icon={FileDigit}
      title={`Binary response, ${formatSize(response.size)}`}
      description={`${mimeType(response)} cannot be shown as text. Download it to open it elsewhere.`}
    />
  )
}

function MediaElement({ kind, url, onError }) {
  if (kind === BODY_KINDS.IMAGE) {
    return <img src={url} alt="Response body" onError={onError} className="h-auto max-w-full rounded-md border border-border/50" />
  }
  if (kind === BODY_KINDS.AUDIO) {
    return <audio src={url} controls onError={onError} className="w-full max-w-xl" />
  }
  if (kind === BODY_KINDS.VIDEO) {
    return <video src={url} controls onError={onError} className="max-h-full max-w-full rounded-md" />
  }
  return <embed src={url} type="application/pdf" className="h-full w-full" />
}

function MediaPreview({ response, kind }) {
  const url = useObjectUrl(response)
  const [failed, setFailed] = useState(false)
  const handleError = useCallback(() => setFailed(true), [])

  if (failed) return <BinaryBody response={response} />
  if (!url) return null

  const isDocument = kind === BODY_KINDS.PDF
  return (
    <div className={isDocument ? "h-full" : "flex min-h-full items-center justify-center p-8"}>
      <MediaElement kind={kind} url={url} onError={handleError} />
    </div>
  )
}

function ResponseBody({ response, kind, view, json }) {
  if (kind === BODY_KINDS.EMPTY) {
    return (
      <EmptyState
        icon={FileX}
        title="Empty response body"
        description={`The server answered ${response.status} without a body.`}
      />
    )
  }
  if (kind === BODY_KINDS.BINARY) return <BinaryBody response={response} />
  if (view === 'pretty') {
    return (
      <div className="json-tree-wrapper p-5 font-mono text-sm">
        <JsonView data={json} shouldExpandNode={(level) => level < JSON_EXPANDED_DEPTH} />
      </div>
    )
  }
  if (view === 'raw') return <TextBody text={response.body} />
  if (kind === BODY_KINDS.HTML) {
    return <iframe srcDoc={response.body} title="Response preview" className="h-full w-full border-none bg-white" sandbox="allow-scripts" />
  }
  return <MediaPreview response={response} kind={kind} />
}

function ErrorBody({ response }) {
  const tone = response.error === 'cancelled' ? 'text-muted-foreground' : 'text-destructive'
  return (
    <div className="flex items-start gap-3 p-6">
      <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{ERROR_TITLES[response.error] || 'Request failed'}</h3>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{response.body}</p>
      </div>
    </div>
  )
}

function StatusSummary({ response }) {
  if (response.error) {
    return <Badge variant="outline" className="px-2 text-[11px] font-semibold">{ERROR_TITLES[response.error] || 'Error'}</Badge>
  }
  return (
    <>
      <Badge variant={statusVariant(response.statusCode)} className="px-2 font-mono text-[11px] font-semibold">{response.status}</Badge>
      <span className="font-mono text-[11px] text-muted-foreground/70">{formatSize(response.size)}</span>
      <span className="font-mono text-[11px] text-muted-foreground/70">{response.durationMs} ms</span>
    </>
  )
}

function usePanelResize() {
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const startDrag = useCallback((event) => {
    const startY = event.clientY
    const startHeight = panelHeight
    setIsDragging(true)

    const handleMouseMove = (moveEvent) => {
      if (!containerRef.current) return
      const available = containerRef.current.parentElement.getBoundingClientRect().height
      const deltaPercent = ((startY - moveEvent.clientY) / available) * 100
      setPanelHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, startHeight + deltaPercent)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelHeight])

  const resetHeight = useCallback(() => setPanelHeight(DEFAULT_PANEL_HEIGHT), [])

  return { containerRef, panelHeight, isDragging, startDrag, resetHeight }
}

function panelStyleFor(isFullscreen, isCollapsed, panelHeight) {
  if (isFullscreen) return { position: 'fixed', inset: 0, zIndex: 50 }
  if (isCollapsed) return { flex: `0 0 ${COLLAPSED_HEIGHT}px`, minHeight: `${COLLAPSED_HEIGHT}px` }
  return { flex: `0 0 ${panelHeight}%`, minHeight: `${COLLAPSED_HEIGHT}px` }
}

export const ResponsePanel = memo(function ResponsePanel({ response, loading, onDownload }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('body')
  const [selectedView, setSelectedView] = useState(null)
  const { containerRef, panelHeight, isDragging, startDrag, resetHeight } = usePanelResize()

  const shown = loading ? null : response
  const hasResult = Boolean(shown && !shown.error)
  const text = textBody(shown)
  const kind = hasResult ? bodyKind(shown) : BODY_KINDS.EMPTY
  const json = useMemo(() => (kind === BODY_KINDS.TEXT ? parseJsonBody(text) : null), [kind, text])
  const views = viewsFor(kind, text !== '', json !== null)
  const view = views.includes(selectedView) ? selectedView : views[0]
  const headers = shown?.headers || []
  const cookies = shown?.cookies || []
  const tabCounts = { headers: headers.length, cookies: cookies.length }
  const hasBody = hasResult && kind !== BODY_KINDS.EMPTY
  const showsBody = !isCollapsed && activeTab === 'body'

  useEffect(() => {
    setActiveTab('body')
    setSelectedView(null)
  }, [response])

  const toggleFullscreen = useCallback(() => setIsFullscreen((current) => !current), [])
  const toggleCollapse = useCallback(() => setIsCollapsed((current) => !current), [])

  const renderContent = () => {
    if (loading) return <EmptyState icon={Loader2} title="Sending request" description="Waiting for the server to answer" />
    if (!shown) return <EmptyState icon={FileText} title="No response yet" description="Send a request to see the response here" />
    if (shown.error) return <ErrorBody response={shown} />
    if (activeTab === 'headers') {
      return <DataTable columns={HEADER_COLUMNS} rows={headers} emptyIcon={List} emptyTitle="No headers" emptySubtitle="The server didn't send any headers" />
    }
    if (activeTab === 'cookies') {
      return <DataTable columns={COOKIE_COLUMNS} rows={cookies} emptyIcon={Cookie} emptyTitle="No cookies" emptySubtitle="The server didn't send any cookies" />
    }
    return <ResponseBody response={shown} kind={kind} view={view} json={json} />
  }

  return (
    <>
      {!isFullscreen && !isCollapsed && (
        <ResizableDivider onDrag={startDrag} isDragging={isDragging} onDoubleClick={resetHeight} />
      )}

      <div
        ref={containerRef}
        className="flex flex-col border-t border-border/60 bg-background"
        style={panelStyleFor(isFullscreen, isCollapsed, panelHeight)}
      >
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/10 px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2.5">
            <button onClick={toggleCollapse} className={ICON_BUTTON_CLASS} title={isCollapsed ? "Expand" : "Collapse"}>
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Response</span>
            {shown && <StatusSummary response={shown} />}
          </div>

          {!isCollapsed && hasResult && (
            <div className="flex items-center rounded-lg bg-muted/40 p-1 ring-1 ring-border/30">
              {TABS.map((tab) => (
                <TabButton
                  key={tab.id}
                  id={tab.id}
                  label={tab.label}
                  icon={tab.icon}
                  count={tabCounts[tab.id]}
                  active={activeTab === tab.id}
                  onClick={setActiveTab}
                />
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {showsBody && text && <CopyButton text={text} />}
            {hasBody && (
              <button onClick={onDownload} className={ICON_BUTTON_CLASS} title="Download body">
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={toggleFullscreen} className={ICON_BUTTON_CLASS} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isCollapsed && hasResult && shown.truncated && (
          <Notice icon={Scissors}>
            This response was cut off at {formatSize(shown.size)} because it exceeded the size limit.
          </Notice>
        )}

        {showsBody && views.length > 1 && (
          <div className="flex items-center border-b border-border/40 bg-muted/5 px-4 py-2">
            <div className="flex items-center rounded-lg bg-muted/30 p-0.5">
              {views.map((option) => (
                <ViewButton key={option} view={option} active={option === view} onClick={setSelectedView} />
              ))}
            </div>
          </div>
        )}

        {!isCollapsed && (
          <div className="relative flex-1 overflow-auto scrollbar-primary">
            {renderContent()}
          </div>
        )}
      </div>

      {isFullscreen && <div className="fixed inset-0 z-40 bg-background/80" onClick={toggleFullscreen} />}
    </>
  )
})
