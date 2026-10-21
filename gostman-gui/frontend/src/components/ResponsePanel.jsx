import { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { JsonView, darkStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import {
  AlertTriangle, BookmarkPlus, Check, ChevronDown, ChevronUp, Cookie, Copy, Download, FileDigit, FileText, FileX, List, Loader2,
  Maximize2, Minimize2, Scissors, Search,
} from "lucide-react"
import { FilterBar, SearchBar } from "./ResponseSearchBar"
import { HighlightedText } from "./HighlightedText"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { MAX_MATCHES, filterJson, findMatches, stepIndex } from "../lib/responseSearch"
import { Badge } from "./ui/badge"
import { IconButton } from "./ui/button"
import { DataTable } from "./ui/dataTable"
import { EmptyState } from "./ui/emptyState"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { TabCount, Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { TestResults, countPassed, hasTestOutput } from "./TestResults"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { formatSize, lookup } from "../lib/dataUtils"
import { canSaveAsExample } from "../lib/examples"
import { MIN_REQUEST_HEIGHT_PX, MIN_RESPONSE_HEIGHT_PX, TOOLBAR_HEIGHT_PX } from "../lib/layout"
import {
  BODY_KINDS, ERROR_TITLES, bodyBytes, bodyKind, mimeType, parseJsonBody, statusVariant, textBody,
} from "../lib/response"

const DEFAULT_PANEL_SHARE = 40
const TEXT_DISPLAY_LIMIT = 500_000
const JSON_EXPANDED_DEPTH = 2
const TAB_BODY = 'body'
const TAB_HEADERS = 'headers'
const TAB_COOKIES = 'cookies'
const TAB_TESTS = 'tests'
const NO_VALUE = '—'
const SEARCH_DEBOUNCE_MS = 200
const NO_FILTER = { active: false }

const VIEW_LABELS = { pretty: 'Pretty', raw: 'Raw', preview: 'Preview' }

const MEDIA_KINDS = [BODY_KINDS.IMAGE, BODY_KINDS.PDF, BODY_KINDS.AUDIO, BODY_KINDS.VIDEO]

const JSON_STYLE = {
  ...darkStyles,
  container: 'font-mono text-xs leading-relaxed whitespace-pre-wrap',
  label: 'mr-1.5 text-syntax-key',
  clickableLabel: 'mr-1.5 cursor-pointer text-syntax-key',
  stringValue: 'text-syntax-string',
  numberValue: 'text-syntax-number',
  booleanValue: 'text-syntax-boolean',
  nullValue: 'text-syntax-null',
  undefinedValue: 'text-syntax-null',
  otherValue: 'text-foreground',
  collapseIcon: `${darkStyles.collapseIcon} !text-foreground`,
  expandIcon: `${darkStyles.expandIcon} !text-foreground`,
  collapsedContent: `${darkStyles.collapsedContent} !text-foreground`,
  punctuation: 'mr-1.5 text-muted-foreground',
}

const flagText = (isSet) => (isSet ? 'Yes' : NO_VALUE)

const HEADER_COLUMNS = [
  { header: 'Name', key: 'key', width: 'w-1/3', cellClassName: 'text-foreground' },
  { header: 'Value', key: 'value' },
]

const COOKIE_COLUMNS = [
  { header: 'Name', key: 'name', cellClassName: 'text-foreground' },
  { header: 'Value', text: (cookie) => cookie.value || NO_VALUE },
  { header: 'Domain', text: (cookie) => cookie.domain || NO_VALUE },
  { header: 'Path', width: 'w-16', text: (cookie) => cookie.path || '/' },
  { header: 'Expires', text: (cookie) => cookie.expires || 'Session' },
  { header: 'Secure', width: 'w-20', text: (cookie) => flagText(cookie.secure) },
  { header: 'HttpOnly', width: 'w-24', text: (cookie) => flagText(cookie.httpOnly) },
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
  const { copied, copy } = useClipboardCopy(text)
  return <IconButton label={copied ? "Copied" : "Copy body"} icon={copied ? Check : Copy} onClick={copy} />
}

function TextBody({ text, highlight }) {
  const shown = displayableText(text)
  return (
    <>
      {shown.length < text.length && (
        <Notice tone="warning" icon={Scissors}>
          Showing the first {formatSize(TEXT_DISPLAY_LIMIT)} of this body. Download it to see everything.
        </Notice>
      )}
      <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-foreground">
        {highlight
          ? <HighlightedText text={shown} matches={highlight.matches} length={highlight.length} activeIndex={highlight.index} />
          : shown}
      </pre>
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
    return <img src={url} alt="Response body" onError={onError} className="max-h-full max-w-full rounded border border-border object-contain" />
  }
  if (kind === BODY_KINDS.AUDIO) {
    return <audio src={url} controls onError={onError} className="w-full max-w-xl" />
  }
  if (kind === BODY_KINDS.VIDEO) {
    return <video src={url} controls onError={onError} className="max-h-full max-w-full rounded" />
  }
  return <embed src={url} type="application/pdf" className="h-full w-full" />
}

function MediaPreview({ response, kind }) {
  const url = useObjectUrl(response)
  const [failed, setFailed] = useState(false)
  const handleError = useCallback(() => setFailed(true), [])

  if (failed) return <BinaryBody response={response} />
  if (!url) return null

  return (
    <div className={kind === BODY_KINDS.PDF ? "h-full" : "flex h-full items-center justify-center p-3"}>
      <MediaElement kind={kind} url={url} onError={handleError} />
    </div>
  )
}

function PrettyBody({ json, filtered, highlight }) {
  const data = filtered ? filtered.value : json
  if (highlight) return <TextBody text={JSON.stringify(data, null, 2)} highlight={highlight} />
  if (data === null || typeof data !== 'object') return <TextBody text={JSON.stringify(data, null, 2)} />
  return (
    <div className="p-3">
      <JsonView data={data} shouldExpandNode={(level) => level < JSON_EXPANDED_DEPTH} style={JSON_STYLE} />
    </div>
  )
}

function ResponseBody({ response, kind, view, json, filtered, highlight }) {
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
  if (view === 'pretty') return <PrettyBody json={json} filtered={filtered} highlight={highlight} />
  if (view === 'raw') return <TextBody text={filtered ? filtered.text : response.body} highlight={highlight} />
  if (kind === BODY_KINDS.HTML) {
    return <iframe srcDoc={response.body} title="Response preview" className="block h-full w-full border-none bg-white" sandbox="" />
  }
  return <MediaPreview response={response} kind={kind} />
}

function ErrorBody({ response }) {
  const title = lookup(ERROR_TITLES, response.error) || 'Request failed'
  return <EmptyState icon={AlertTriangle} title={title} description={response.body} />
}

function StatusSummary({ response }) {
  if (response.error) {
    return <Badge variant="outline">{lookup(ERROR_TITLES, response.error) || 'Error'}</Badge>
  }
  const timing = `${response.durationMs} ms · ${formatSize(response.size)}`
  return (
    <>
      <Badge variant={statusVariant(response)} title={response.status} className="max-w-[9rem] font-mono">
        <span className="truncate">{response.status}</span>
      </Badge>
      <span title={timing} className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{timing}</span>
    </>
  )
}

const clamp = (value, lowest, highest) => Math.max(lowest, Math.min(highest, value))

function usePanelResize() {
  const [panelShare, setPanelShare] = useState(DEFAULT_PANEL_SHARE)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const startDrag = useCallback((event) => {
    event.preventDefault()
    const available = containerRef.current.parentElement.getBoundingClientRect().height
    const startY = event.clientY
    const startHeight = containerRef.current.getBoundingClientRect().height
    const highest = Math.max(MIN_RESPONSE_HEIGHT_PX, available - MIN_REQUEST_HEIGHT_PX)
    setIsDragging(true)

    const handleMouseMove = (moveEvent) => {
      const height = clamp(startHeight + startY - moveEvent.clientY, MIN_RESPONSE_HEIGHT_PX, highest)
      setPanelShare((height / available) * 100)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const resetHeight = useCallback(() => setPanelShare(DEFAULT_PANEL_SHARE), [])

  return { containerRef, panelShare, isDragging, startDrag, resetHeight }
}

function panelStyleFor(isFullscreen, isCollapsed, panelShare) {
  if (isFullscreen) return { position: 'fixed', inset: 0, zIndex: 40 }
  if (isCollapsed) return { flex: `0 0 ${TOOLBAR_HEIGHT_PX}px` }
  return { flex: `0 1 ${panelShare}%`, minHeight: MIN_RESPONSE_HEIGHT_PX }
}

export const ResponsePanel = memo(function ResponsePanel({ response, tests, loading, onDownload, onSaveExample }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState(TAB_BODY)
  const [selectedView, setSelectedView] = useState(null)
  const { containerRef, panelShare, isDragging, startDrag, resetHeight } = usePanelResize()

  const shown = loading ? null : response
  const hasResult = Boolean(shown && !shown.error)
  const text = textBody(shown)
  const kind = hasResult ? bodyKind(shown) : BODY_KINDS.EMPTY
  const json = useMemo(() => (kind === BODY_KINDS.TEXT ? parseJsonBody(text) : null), [kind, text])
  const views = viewsFor(kind, text !== '', json !== null)
  const view = views.includes(selectedView) ? selectedView : views[0]
  const headers = shown?.headers || []
  const cookies = shown?.cookies || []
  const showsTests = hasTestOutput(tests)
  const hasBody = hasResult && kind !== BODY_KINDS.EMPTY
  const isOpen = isFullscreen || !isCollapsed
  const showsBody = isOpen && activeTab === TAB_BODY
  const showsTabs = isOpen && hasResult

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [filterPath, setFilterPath] = useState('')
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const debouncedPath = useDebouncedValue(filterPath, SEARCH_DEBOUNCE_MS)

  const filter = useMemo(() => (json === null ? NO_FILTER : filterJson(json, debouncedPath)), [json, debouncedPath])
  const filtered = filter.active && !filter.error ? filter : null
  const canSearch = showsBody && hasBody && (view === 'pretty' || view === 'raw')
  const searching = searchOpen && canSearch && debouncedQuery !== ''
  const searchText = useMemo(() => {
    if (!searching) return ''
    const base = view === 'pretty' ? JSON.stringify(filtered ? filtered.value : json, null, 2) : (filtered ? filtered.text : text)
    return displayableText(base)
  }, [searching, view, filtered, json, text])
  const matches = useMemo(() => findMatches(searchText, debouncedQuery), [searchText, debouncedQuery])
  const activeMatch = Math.min(matchIndex, Math.max(matches.length - 1, 0))
  const highlight = searching ? { matches, length: debouncedQuery.length, index: activeMatch } : null
  const copyText = filtered ? filtered.text : text

  useEffect(() => {
    setActiveTab(TAB_BODY)
    setSelectedView(null)
    setSearchOpen(false)
    setQuery('')
    setFilterPath('')
  }, [response])

  useEffect(() => setMatchIndex(0), [debouncedQuery, view, filtered])

  const stepMatch = useCallback((direction) => setMatchIndex(stepIndex(activeMatch, matches.length, direction)), [activeMatch, matches.length])
  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    containerRef.current?.focus()
  }, [containerRef])
  const handleKeyDown = (event) => {
    if (!canSearch || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f') return
    event.preventDefault()
    setSearchOpen(true)
  }

  const toggleFullscreen = useCallback(() => setIsFullscreen((current) => !current), [])
  const toggleCollapse = useCallback(() => setIsCollapsed((current) => !current), [])

  const renderContent = () => {
    if (loading) return <EmptyState icon={Loader2} title="Sending request" description="Waiting for the server to answer." />
    if (!shown) return <EmptyState icon={FileText} title="No response yet" description="Send a request to see the response here." />
    if (shown.error) return <ErrorBody response={shown} />
    if (activeTab === TAB_TESTS && showsTests) return <TestResults tests={tests} />
    if (activeTab === TAB_HEADERS) {
      if (headers.length === 0) return <EmptyState icon={List} title="No headers" description="The server sent no headers." />
      return <DataTable columns={HEADER_COLUMNS} rows={headers} />
    }
    if (activeTab === TAB_COOKIES) {
      if (cookies.length === 0) return <EmptyState icon={Cookie} title="No cookies" description="The server sent no cookies." />
      return <DataTable columns={COOKIE_COLUMNS} rows={cookies} />
    }
    return <ResponseBody response={shown} kind={kind} view={view} json={json} filtered={filtered} highlight={highlight} />
  }

  return (
    <>
      {isOpen && !isFullscreen && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the response panel"
          title="Drag to resize. Double-click to reset."
          onMouseDown={startDrag}
          onDoubleClick={resetHeight}
          className={`h-1 shrink-0 cursor-row-resize border-t border-border ${isDragging ? 'bg-border' : 'hover:bg-border'}`}
        />
      )}

      <section
        ref={containerRef}
        aria-label="Response"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex min-h-0 flex-col bg-background outline-none ${isOpen && !isFullscreen ? '' : 'border-t border-border'}`}
        style={panelStyleFor(isFullscreen, isCollapsed, panelShare)}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <Toolbar className={isOpen ? "pl-1.5 pr-1.5" : "border-b-0 pl-1.5 pr-1.5"}>
            {!isFullscreen && (
              <IconButton
                label={isCollapsed ? "Expand response" : "Collapse response"}
                icon={isCollapsed ? ChevronUp : ChevronDown}
                onClick={toggleCollapse}
              />
            )}
            {showsTabs ? (
              <TabsList label="Response sections" className="shrink-0 pl-1.5">
                <TabsTrigger value={TAB_BODY}>Body</TabsTrigger>
                <TabsTrigger value={TAB_HEADERS}>Headers<TabCount>{headers.length}</TabCount></TabsTrigger>
                <TabsTrigger value={TAB_COOKIES}>Cookies<TabCount>{cookies.length}</TabCount></TabsTrigger>
                {showsTests && (
                  <TabsTrigger value={TAB_TESTS}>
                    Tests<TabCount>{countPassed(tests.results)}/{tests.results.length}</TabCount>
                  </TabsTrigger>
                )}
              </TabsList>
            ) : (
              <SectionLabel className="pl-1.5">Response</SectionLabel>
            )}

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {shown && <StatusSummary response={shown} />}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {canSearch && (
                <IconButton
                  label={searchOpen ? "Close search" : "Search body (Ctrl+F)"}
                  icon={Search}
                  onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                />
              )}
              {showsBody && copyText && <CopyButton text={copyText} />}
              {hasBody && <IconButton label="Download body" icon={Download} onClick={onDownload} />}
              {canSaveAsExample(shown) && <IconButton label="Save as example" icon={BookmarkPlus} onClick={onSaveExample} />}
              <IconButton
                label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                icon={isFullscreen ? Minimize2 : Maximize2}
                onClick={toggleFullscreen}
              />
            </div>
          </Toolbar>

          {isOpen && hasResult && shown.truncated && (
            <Notice tone="warning" icon={Scissors}>
              This response was cut off at {formatSize(shown.size)} because it exceeded the size limit.
            </Notice>
          )}

          {showsBody && views.length > 1 && (
            <Toolbar>
              <SegmentedControl
                label="Body view"
                options={views.map((option) => ({ value: option, label: VIEW_LABELS[option] }))}
                value={view}
                onChange={setSelectedView}
              />
            </Toolbar>
          )}

          {showsBody && hasBody && json !== null && (
            <FilterBar path={filterPath} onPathChange={setFilterPath} error={filter.error} />
          )}

          {searchOpen && canSearch && (
            <SearchBar
              query={query}
              onQueryChange={setQuery}
              index={activeMatch}
              count={matches.length}
              capped={matches.length >= MAX_MATCHES}
              onStep={stepMatch}
              onClose={closeSearch}
            />
          )}

          {isOpen && (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere]">
              {renderContent()}
            </div>
          )}
        </Tabs>
      </section>
    </>
  )
})
