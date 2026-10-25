import { Suspense, lazy, memo, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { JsonView, darkStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import {
  AlertTriangle, BookmarkPlus, Check, ChevronDown, ChevronUp, Cookie, Copy, Download, FileDigit, FileText, FileX, History, List, ListPlus,
  Maximize2, MessageCircleQuestion, Minimize2, Scissors, Search, ShieldCheck,
} from "lucide-react"
import { ConsolePanel } from "./ConsolePanel"
import { AiButton } from "./AiButton"
import { FilterBar, SearchBar } from "./ResponseSearchBar"
import { HighlightedText } from "./HighlightedText"
import { LargeText } from "./LargeText"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { FORMAT_DONE, FORMAT_FAILED, FORMAT_WORKING, useOffThreadFilter, useOffThreadFormat } from "../hooks/useOffThreadJson"
import { MAX_MATCHES, findMatches, stepIndex } from "../lib/responseSearch"
import { Badge } from "./ui/badge"
import { ContextMenu } from "./ui/ContextMenu"
import { Button, IconButton } from "./ui/button"
import { DataTable } from "./ui/dataTable"
import { EmptyState } from "./ui/emptyState"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { ProtocolBody } from "./ProtocolBody"
import { SegmentedControl } from "./ui/segmented"
import { OverflowTabsList, TabCount, Tabs } from "./ui/tabs"
import { SkeletonLines } from "./ui/skeleton"
import { TestResults, countPassed, hasTestOutput } from "./TestResults"
import { VisualizeTab } from "./VisualizeTab"
import { TimelineTab } from "./TimelineTab"
import { UnresolvedNotice } from "./UnresolvedNotice"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { asSentence, lookup } from "../lib/dataUtils"
import { errorBodyOf } from "../lib/responseError"
import { formatBytes } from "../lib/byteSize"
import { isFailedResponse } from "../lib/ai/tasks"
import { MCP_PROTOCOL } from "../lib/mcp"
import { shortcutLabel } from "../lib/platform"
import { AI_TEXT } from "../lib/aiText"
import { RESPONSE_CHECKS_TEXT } from "../lib/checksText"
import { canSaveAsExample } from "../lib/examples"
import { trimTree } from "../lib/jsonTree"
import { LARGE_BODY_CHARS } from "../lib/largeText"
import { PREVIEW_TEXT, RESPONSE_TEXT } from "../lib/responseText"
import { previewDocument } from "../lib/visualizeFrame"
import { breakdownTitle } from "../lib/timeline"
import { canProposeChecks } from "../lib/responseChecks"
import { describeResponse, formatTime } from "../lib/responseHistory"
import { cn } from "../lib/utils"
import { RESTRICTED_ERROR } from "../lib/execution"
import { WORKSPACE_TEXT } from "../lib/workspaceText"
import {
  DEFAULT_RESPONSE_SHARE, MIN_REQUEST_HEIGHT_PX, MIN_RESPONSE_HEIGHT_PX, rememberResponseShare, rememberedResponseShare,
} from "../lib/layout"
import {
  BODY_KINDS, ERROR_TITLES, bodyBytes, bodyKind, dataUrl, isScriptableImage, looksLikeJson, mimeType, parseJsonBody, statusVariant, textBody,
} from "../lib/response"

const JSON_EXPANDED_DEPTH = 2
const MCP_EXPANDED_DEPTH = 3
const TAB_BODY = 'body'
const TAB_HEADERS = 'headers'
const TAB_COOKIES = 'cookies'
const TAB_TESTS = 'tests'
const TAB_CONSOLE = 'console'
const TAB_VISUALIZE = 'visualize'
const TAB_TIMELINE = 'timeline'
const NO_VALUE = '—'
const SEARCH_DEBOUNCE_MS = 200

const NO_HISTORY = []
const MENU_GAP_PX = 4
const LINK_BUTTON = 'font-medium text-primary underline-offset-2 hover:underline'
const TOOLBAR_ROW = 'h-[calc(2.5rem-1px)]'

const ResponseCompareDialog = lazy(() => import("./ResponseCompareDialog").then((module) => ({ default: module.ResponseCompareDialog })))
const AddChecksDialog = lazy(() => import("./AddChecksDialog").then((module) => ({ default: module.AddChecksDialog })))

const HISTORY_TEXT = RESPONSE_TEXT.history

const MEDIA_KINDS = [BODY_KINDS.IMAGE, BODY_KINDS.PDF, BODY_KINDS.AUDIO, BODY_KINDS.VIDEO]

const JSON_STYLE = {
  ...darkStyles,
  container: 'font-mono text-xs leading-relaxed whitespace-pre-wrap',
  label: 'me-1.5 text-syntax-key',
  clickableLabel: 'me-1.5 cursor-pointer text-syntax-key',
  stringValue: 'text-syntax-string',
  numberValue: 'text-syntax-number',
  booleanValue: 'text-syntax-boolean',
  nullValue: 'text-syntax-null',
  undefinedValue: 'text-syntax-null',
  otherValue: 'text-foreground',
  collapseIcon: `${darkStyles.collapseIcon} !text-foreground`,
  expandIcon: `${darkStyles.expandIcon} !text-foreground`,
  collapsedContent: `${darkStyles.collapsedContent} !text-foreground`,
  punctuation: `${darkStyles.punctuation} !font-normal !text-muted-foreground`,
}

const flagText = (isSet) => (isSet ? RESPONSE_TEXT.yes : NO_VALUE)

const testTone = (tests) => (tests.error || countPassed(tests.results) < tests.results.length ? 'destructive' : 'success')

const COLUMN_TEXT = RESPONSE_TEXT.columns

const headerColumns = () => [
  { header: COLUMN_TEXT.name, key: 'key', width: 'w-1/3', cellClassName: 'text-foreground' },
  { header: COLUMN_TEXT.value, key: 'value' },
]

const cookieColumns = () => [
  { header: COLUMN_TEXT.name, key: 'name', cellClassName: 'text-foreground' },
  { header: COLUMN_TEXT.value, text: (cookie) => cookie.value || NO_VALUE },
  { header: COLUMN_TEXT.domain, text: (cookie) => cookie.domain || NO_VALUE },
  { header: COLUMN_TEXT.path, width: 'w-16', text: (cookie) => cookie.path || '/' },
  { header: COLUMN_TEXT.expires, text: (cookie) => cookie.expires || RESPONSE_TEXT.sessionCookie },
  { header: COLUMN_TEXT.secure, width: 'w-20', text: (cookie) => flagText(cookie.secure) },
  { header: COLUMN_TEXT.httpOnly, width: 'w-24', text: (cookie) => flagText(cookie.httpOnly) },
]

function viewsFor(kind, isText, isJson) {
  if (isJson) return ['pretty', 'raw']
  if (kind === BODY_KINDS.HTML) return ['raw', 'preview']
  if (kind === BODY_KINDS.TEXT) return ['raw']
  if (!MEDIA_KINDS.includes(kind)) return []
  return isText ? ['preview', 'raw'] : ['preview']
}

function useObjectUrl(response) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (isScriptableImage(response)) {
      setUrl(dataUrl(response))
      return undefined
    }
    const objectUrl = URL.createObjectURL(new Blob([bodyBytes(response)], { type: mimeType(response) }))
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [response])

  return url
}

function CopyButton({ text }) {
  const { copied, copy } = useClipboardCopy(text)
  return <IconButton label={copied ? RESPONSE_TEXT.copied : RESPONSE_TEXT.copyBody} icon={copied ? Check : Copy} onClick={copy} />
}

function TextBody({ text, highlight }) {
  if (text.length > LARGE_BODY_CHARS) return <LargeText text={text} highlight={highlight} />
  return (
    <pre dir="ltr" className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-foreground">
      {highlight
        ? <HighlightedText text={text} matches={highlight.matches} length={highlight.length} activeIndex={highlight.index} />
        : text}
    </pre>
  )
}

function BinaryBody({ response, onSave }) {
  return (
    <EmptyState
      icon={FileDigit}
      title={RESPONSE_TEXT.binaryTitle(formatBytes(response.size))}
      description={RESPONSE_TEXT.binaryDescription(mimeType(response))}
      action={onSave && <Button size="sm" variant="outline" onClick={onSave}><Download />{RESPONSE_TEXT.saveToFile}</Button>}
    />
  )
}

function LargeBodyNotice({ size, canFormat, formatted, onFormat }) {
  const isWorking = formatted.status === FORMAT_WORKING
  return (
    <Notice tone={formatted.status === FORMAT_FAILED ? 'warning' : undefined} icon={FileText}>
      {formatted.error || RESPONSE_TEXT.largeBody(size)}{' '}
      {canFormat && (
        <button type="button" className={LINK_BUTTON} disabled={isWorking} onClick={onFormat}>
          {isWorking ? RESPONSE_TEXT.formatting : RESPONSE_TEXT.formatAnyway}
        </button>
      )}
    </Notice>
  )
}

function MediaElement({ kind, url, onError }) {
  if (kind === BODY_KINDS.IMAGE) {
    return <img src={url} alt={RESPONSE_TEXT.bodyLabel} onError={onError} className="max-h-full max-w-full rounded border border-border object-contain" />
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

function PrettyBody({ json, formatted, filtered, highlight, depth }) {
  if (formatted !== null) return <TextBody text={filtered ? filtered.text : formatted} highlight={highlight} />
  const data = filtered ? filtered.value : json
  if (highlight) return <TextBody text={JSON.stringify(data, null, 2)} highlight={highlight} />
  if (data === null || typeof data !== 'object') return <TextBody text={JSON.stringify(data, null, 2)} />
  return <JsonTree data={data} depth={depth} />
}

function JsonTree({ data, depth }) {
  const { value, omitted } = useMemo(() => trimTree(data), [data])
  return (
    <>
      {omitted > 0 && (
        <Notice tone="warning" icon={Scissors}>
          {RESPONSE_TEXT.treeTrimmed(omitted)}
        </Notice>
      )}
      <div dir="ltr" className="p-3">
        <JsonView data={value} shouldExpandNode={(level) => level < depth} style={JSON_STYLE} />
      </div>
    </>
  )
}

function HtmlPreview({ response }) {
  const [loadedFor, setLoadedFor] = useState(null)
  const remote = loadedFor === response
  const srcDoc = useMemo(() => previewDocument(response.body, { remote, url: response.url }), [response, remote])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Notice icon={ShieldCheck}>
        {remote ? PREVIEW_TEXT.loaded : PREVIEW_TEXT.blocked}
        <button type="button" onClick={() => setLoadedFor(remote ? null : response)} className="ms-2 font-medium underline">
          {remote ? PREVIEW_TEXT.block : PREVIEW_TEXT.load}
        </button>
      </Notice>
      <iframe srcDoc={srcDoc} title={RESPONSE_TEXT.previewTitle} sandbox="" referrerPolicy="no-referrer" className="block min-h-0 w-full flex-1 border-none bg-white" />
    </div>
  )
}

function ResponseBody({ response, kind, view, json, formatted, filtered, highlight, onSave }) {
  if (kind === BODY_KINDS.EMPTY) {
    return (
      <EmptyState
        icon={FileX}
        title={RESPONSE_TEXT.emptyTitle}
        description={RESPONSE_TEXT.emptyDescription(response.status)}
      />
    )
  }
  if (kind === BODY_KINDS.BINARY) return <BinaryBody response={response} onSave={onSave} />
  if (view === 'pretty') return <PrettyBody json={json} formatted={formatted} filtered={filtered} highlight={highlight} depth={treeDepth(response)} />
  if (view === 'raw') return <TextBody text={filtered ? filtered.text : response.body} highlight={highlight} />
  if (kind === BODY_KINDS.HTML) return <HtmlPreview response={response} />
  return <MediaPreview response={response} kind={kind} />
}

function ErrorAction({ response, onExplain, onTrust }) {
  if (response.error === RESTRICTED_ERROR && onTrust) return <Button size="sm" variant="outline" onClick={onTrust}>{WORKSPACE_TEXT.trust}</Button>
  return onExplain && <AiButton label={AI_TEXT.buttons.explainError} onClick={onExplain}>{AI_TEXT.buttons.explain}</AiButton>
}

function ErrorBody({ response, onExplain, onTrust }) {
  const title = lookup(ERROR_TITLES, response.error) || RESPONSE_TEXT.requestFailed
  return <EmptyState icon={AlertTriangle} title={title} description={asSentence(errorBodyOf(response))} className="whitespace-pre-line" action={<ErrorAction response={response} onExplain={onExplain} onTrust={onTrust} />} />
}

function StatusSummary({ response }) {
  if (response.error) {
    const label = response.error === RESTRICTED_ERROR ? RESPONSE_TEXT.error : lookup(ERROR_TITLES, response.error) || RESPONSE_TEXT.error
    return <Badge variant="outline">{label}</Badge>
  }
  const timing = `${RESPONSE_TEXT.milliseconds(response.durationMs)} · ${formatBytes(response.size)}`
  const detail = [timing, breakdownTitle(response.timeline)].filter(Boolean).join('\n\n')
  return (
    <>
      <Badge variant={statusVariant(response)} title={response.status} className="min-w-0 shrink font-mono">
        <span className="truncate">{response.status}</span>
      </Badge>
      <span title={detail} className="min-w-0 truncate font-mono text-2xs text-muted-foreground max-md:hidden">{timing}</span>
    </>
  )
}

const treeDepth = (response) => (response.protocol === MCP_PROTOCOL ? MCP_EXPANDED_DEPTH : JSON_EXPANDED_DEPTH)

const tabItem = (value, badge = null, marked = false) => ({
  value,
  label: RESPONSE_TEXT.tabs[value],
  marked,
  detail: badge,
  content: <>{RESPONSE_TEXT.tabs[value]}{badge}</>,
})

function responseTabs({ hasResult, hasTimeline, showsTests, headers, cookies, tests }) {
  return [
    tabItem(TAB_BODY),
    hasResult && tabItem(TAB_HEADERS, <TabCount>{headers.length}</TabCount>, headers.length > 0),
    hasResult && tabItem(TAB_COOKIES, <TabCount>{cookies.length}</TabCount>, cookies.length > 0),
    hasTimeline && tabItem(TAB_TIMELINE),
    showsTests && tabItem(TAB_TESTS, <TabCount tone={testTone(tests)}>{countPassed(tests.results)}/{tests.results.length}</TabCount>, true),
    tabItem(TAB_CONSOLE),
    tests?.visualization && tabItem(TAB_VISUALIZE),
  ].filter(Boolean)
}

const clamp = (value, lowest, highest) => Math.max(lowest, Math.min(highest, value))

const KEY_SHARE_STEPS = { ArrowUp: 5, ArrowDown: -5 }

function usePanelResize() {
  const [panelShare, setPanelShare] = useState(rememberedResponseShare)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const startDrag = useCallback((event) => {
    event.preventDefault()
    const available = containerRef.current.parentElement.getBoundingClientRect().height
    const startY = event.clientY
    const startHeight = containerRef.current.getBoundingClientRect().height
    const highest = Math.max(MIN_RESPONSE_HEIGHT_PX, available - MIN_REQUEST_HEIGHT_PX)
    let share = (startHeight / available) * 100
    setIsDragging(true)

    const handleMouseMove = (moveEvent) => {
      const height = clamp(startHeight + startY - moveEvent.clientY, MIN_RESPONSE_HEIGHT_PX, highest)
      share = (height / available) * 100
      setPanelShare(share)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      rememberResponseShare(share)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const resetHeight = useCallback(() => {
    setPanelShare(DEFAULT_RESPONSE_SHARE)
    rememberResponseShare(DEFAULT_RESPONSE_SHARE)
  }, [])

  const nudgeHeight = (event) => {
    const step = KEY_SHARE_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const available = containerRef.current.parentElement.getBoundingClientRect().height
    const lowest = (MIN_RESPONSE_HEIGHT_PX / available) * 100
    const highest = Math.max(lowest, ((available - MIN_REQUEST_HEIGHT_PX) / available) * 100)
    const next = clamp(panelShare + step, lowest, highest)
    setPanelShare(next)
    rememberResponseShare(next)
  }

  return { containerRef, panelShare, isDragging, startDrag, resetHeight, nudgeHeight }
}

function panelStyleFor(isFullscreen, isCollapsed, panelShare) {
  if (isFullscreen) return { position: 'fixed', inset: 0, zIndex: 40 }
  if (isCollapsed) return { flex: '0 0 auto' }
  return { flex: `0 1 ${panelShare}%`, minHeight: MIN_RESPONSE_HEIGHT_PX }
}

function historyMenuItems(earlier, past, select) {
  const latest = past ? [{ id: 'latest', label: HISTORY_TEXT.latest, onSelect: () => select(null) }] : []
  return [...latest, ...earlier.map((entry) => ({ id: String(entry.at), label: describeResponse(entry), onSelect: () => select(entry.at) }))]
}

function PastResponseNotice({ past, canCompare, onCompare, onBack }) {
  return (
    <Notice icon={History}>
      {HISTORY_TEXT.showing(formatTime(past.at))}{' '}
      {canCompare && (
        <>
          <button type="button" className={LINK_BUTTON} onClick={onCompare}>{HISTORY_TEXT.compare}</button>
          {' · '}
        </>
      )}
      <button type="button" className={LINK_BUTTON} onClick={onBack}>{HISTORY_TEXT.back}</button>
    </Notice>
  )
}

export const ResponsePanel = memo(function ResponsePanel({ response, history = NO_HISTORY, tests, loading, onDownload, onSaveExample, onExplain, onTrust }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState(TAB_BODY)
  const [selectedView, setSelectedView] = useState(null)
  const [pastAt, setPastAt] = useState(null)
  const [historyMenu, setHistoryMenu] = useState(null)
  const [isComparing, setIsComparing] = useState(false)
  const [isAddingChecks, setIsAddingChecks] = useState(false)
  const { containerRef, panelShare, isDragging, startDrag, resetHeight, nudgeHeight } = usePanelResize()

  const earlier = useMemo(() => history.filter((entry) => entry.response !== response), [history, response])
  const latestEntry = history.find((entry) => entry.response === response)
  const past = earlier.find((entry) => entry.at === pastAt)
  const shown = loading ? null : past?.response ?? response
  const hasResult = Boolean(shown && !shown.error)
  const text = textBody(shown)
  const kind = hasResult ? bodyKind(shown) : BODY_KINDS.EMPTY
  const isLarge = kind === BODY_KINDS.TEXT && text.length > LARGE_BODY_CHARS
  const canFormat = isLarge && looksLikeJson(text)
  const json = useMemo(() => (kind === BODY_KINDS.TEXT && !isLarge ? parseJsonBody(text) : null), [kind, isLarge, text])
  const { formatted, format } = useOffThreadFormat(text)
  const views = viewsFor(kind, text !== '', json !== null || formatted.text !== null)
  const view = views.includes(selectedView) ? selectedView : views[0]
  const headers = shown?.headers || []
  const cookies = shown?.cookies || []
  const showsTests = hasTestOutput(tests)
  const hasBody = hasResult && kind !== BODY_KINDS.EMPTY
  const isOpen = isFullscreen || !isCollapsed
  const showsBody = isOpen && activeTab === TAB_BODY
  const hasTimeline = Boolean(shown?.timeline)
  const showsTabs = isOpen && (hasResult || hasTimeline)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [filterPath, setFilterPath] = useState('')
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const debouncedPath = useDebouncedValue(filterPath, SEARCH_DEBOUNCE_MS)

  const filter = useOffThreadFilter(text, json !== null || canFormat, debouncedPath, json !== null)
  const filtered = filter.active && !filter.error ? filter : null
  const canSearch = showsBody && hasBody && (view === 'pretty' || view === 'raw')
  const searching = searchOpen && canSearch && debouncedQuery !== ''
  const searchText = useMemo(() => {
    if (!searching) return ''
    if (filtered) return filtered.text
    if (view === 'pretty') return formatted.text ?? JSON.stringify(json, null, 2)
    return text
  }, [searching, view, filtered, json, text, formatted.text])
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
    setPastAt(null)
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

  const openHistory = (event) => {
    const { left, bottom } = event.currentTarget.getBoundingClientRect()
    setHistoryMenu({ x: left, y: bottom + MENU_GAP_PX })
  }

  const toggleFullscreen = useCallback(() => setIsFullscreen((current) => !current), [])
  const toggleCollapse = useCallback(() => setIsCollapsed((current) => !current), [])

  const renderContent = () => {
    if (loading) return <SkeletonLines label={RESPONSE_TEXT.sending} lines={6} />
    if (!shown) return <EmptyState icon={FileText} title={RESPONSE_TEXT.noResponseTitle} description={RESPONSE_TEXT.noResponseDescription} />
    if (activeTab === TAB_TIMELINE && hasTimeline) return <TimelineTab timeline={shown.timeline} />
    if (shown.error) return <ErrorBody response={shown} onExplain={onExplain} onTrust={onTrust} />
    if (activeTab === TAB_TESTS && showsTests) return <TestResults tests={tests} />
    if (activeTab === TAB_CONSOLE) return <ConsolePanel />
    if (activeTab === TAB_VISUALIZE && tests?.visualization) return <VisualizeTab html={tests.visualization} />
    if (activeTab === TAB_HEADERS) {
      if (headers.length === 0) return <EmptyState icon={List} title={RESPONSE_TEXT.noHeadersTitle} description={RESPONSE_TEXT.noHeadersDescription} />
      return <div dir="ltr"><DataTable columns={headerColumns()} rows={headers} /></div>
    }
    if (activeTab === TAB_COOKIES) {
      if (cookies.length === 0) return <EmptyState icon={Cookie} title={RESPONSE_TEXT.noCookiesTitle} description={RESPONSE_TEXT.noCookiesDescription} />
      return <div dir="ltr"><DataTable columns={cookieColumns()} rows={cookies} /></div>
    }
    return (
      <ResponseBody
        response={shown}
        kind={kind}
        view={view}
        json={json}
        formatted={formatted.text}
        filtered={filtered}
        highlight={highlight}
        onSave={past ? undefined : onDownload}
      />
    )
  }

  return (
    <>
      {isOpen && !isFullscreen && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-label={RESPONSE_TEXT.resize}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(panelShare)}
          title={RESPONSE_TEXT.resizeHint}
          onMouseDown={startDrag}
          onKeyDown={nudgeHeight}
          onDoubleClick={resetHeight}
          className={`h-1 shrink-0 cursor-row-resize border-t border-border ${isDragging ? 'bg-border' : 'hover:bg-border'}`}
        />
      )}

      <section
        ref={containerRef}
        aria-label={RESPONSE_TEXT.panel}
        data-pane="response"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex min-h-0 flex-col bg-background outline-none ${isOpen && !isFullscreen ? '' : 'border-t border-border'}`}
        style={panelStyleFor(isFullscreen, isCollapsed, panelShare)}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <Toolbar className={cn("h-auto min-h-10 flex-wrap gap-y-0 ps-1.5 pe-1.5", !isOpen && "border-b-0")}>
            {!isFullscreen && (
              <IconButton
                label={isCollapsed ? RESPONSE_TEXT.expand : RESPONSE_TEXT.collapse}
                icon={isCollapsed ? ChevronUp : ChevronDown}
                onClick={toggleCollapse}
              />
            )}
            {showsTabs ? (
              <OverflowTabsList
                label={RESPONSE_TEXT.sections}
                items={responseTabs({ hasResult, hasTimeline, showsTests, headers, cookies, tests })}
                moreLabel={RESPONSE_TEXT.more}
                moreHint={RESPONSE_TEXT.moreHint}
                className={cn(TOOLBAR_ROW, "ps-1.5")}
              />
            ) : (
              <SectionLabel className="ps-1.5">{RESPONSE_TEXT.panel}</SectionLabel>
            )}

            <div className="ms-auto flex min-w-0 max-w-full items-center gap-2">
              <div role="status" className={cn(TOOLBAR_ROW, "flex min-w-0 items-center gap-2")}>
                {shown && <StatusSummary response={shown} />}
                {showsTests && !past && tests.results.length > 0 && (
                  <span className="sr-only">{RESPONSE_TEXT.checksPassed(countPassed(tests.results), tests.results.length)}</span>
                )}
              </div>

              <div className={cn(TOOLBAR_ROW, "flex shrink-0 items-center gap-1")}>
                {earlier.length > 0 && <IconButton label={HISTORY_TEXT.menu} icon={History} onClick={openHistory} />}
                {canSearch && (
                  <IconButton
                    label={searchOpen ? RESPONSE_TEXT.closeSearch : RESPONSE_TEXT.searchBody(shortcutLabel("F"))}
                    icon={Search}
                    onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                  />
                )}
                {showsBody && copyText && <CopyButton text={copyText} />}
                {hasBody && !past && <IconButton label={RESPONSE_TEXT.downloadBody} icon={Download} onClick={onDownload} />}
                {onExplain && isFailedResponse(shown) && !shown.error && <IconButton label={AI_TEXT.buttons.explain} icon={MessageCircleQuestion} onClick={onExplain} />}
                {canSaveAsExample(shown) && !past && <IconButton label={RESPONSE_TEXT.saveExample} icon={BookmarkPlus} onClick={onSaveExample} />}
                {canProposeChecks(shown) && !past && <IconButton label={RESPONSE_CHECKS_TEXT.button} icon={ListPlus} onClick={() => setIsAddingChecks(true)} />}
                <IconButton
                  label={isFullscreen ? RESPONSE_TEXT.exitFullscreen : RESPONSE_TEXT.fullscreen}
                  icon={isFullscreen ? Minimize2 : Maximize2}
                  onClick={toggleFullscreen}
                />
              </div>
            </div>
          </Toolbar>

          {isOpen && past && (
            <PastResponseNotice past={past} canCompare={Boolean(latestEntry)} onCompare={() => setIsComparing(true)} onBack={() => setPastAt(null)} />
          )}

          {isOpen && hasResult && shown.truncated && (
            <Notice tone="warning" icon={Scissors}>{RESPONSE_TEXT.truncated(formatBytes(shown.size))}</Notice>
          )}

          {isOpen && <UnresolvedNotice response={shown} />}

          {showsBody && isLarge && formatted.status !== FORMAT_DONE && (
            <LargeBodyNotice size={formatBytes(shown.size)} canFormat={canFormat} formatted={formatted} onFormat={format} />
          )}

          {showsBody && views.length > 1 && (
            <Toolbar>
              <SegmentedControl
                label={RESPONSE_TEXT.bodyView}
                options={views.map((option) => ({ value: option, label: RESPONSE_TEXT.views[option] }))}
                value={view}
                onChange={setSelectedView}
              />
            </Toolbar>
          )}

          {showsBody && hasBody && (json !== null || canFormat) && (
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
              <ProtocolBody response={shown} isLoading={loading} isBodyShown={activeTab === TAB_BODY}>
                {renderContent()}
              </ProtocolBody>
            </div>
          )}
        </Tabs>
      </section>
      {historyMenu && (
        <ContextMenu position={historyMenu} title={HISTORY_TEXT.menu} items={historyMenuItems(earlier, past, setPastAt)} onClose={() => setHistoryMenu(null)} />
      )}
      {isComparing && past && latestEntry && (
        <Suspense fallback={null}>
          <ResponseCompareDialog earlier={past} latest={latestEntry} onClose={() => setIsComparing(false)} />
        </Suspense>
      )}
      {isAddingChecks && shown && (
        <Suspense fallback={null}>
          <AddChecksDialog response={shown} onClose={() => setIsAddingChecks(false)} />
        </Suspense>
      )}
    </>
  )
})
