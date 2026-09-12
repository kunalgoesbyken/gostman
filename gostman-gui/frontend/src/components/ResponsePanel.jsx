import React, { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import { Badge } from "./ui/badge"
import { Code, Eye, List, Cookie, Maximize2, Minimize2, ChevronDown, ChevronUp, Copy, Check, FileText, Braces, Minus, AlertTriangle } from "lucide-react"
import { parseError, getErrorConfig } from "../lib/errors"
import { DataTable } from "./ui/dataTable"
import { tryParseJSON, formatSize, parseCookieString, normalizeHeaders } from "../lib/dataUtils"
import { getStatusVariant, detectContentType } from "../lib/responseUtils"

// Constants
const DEFAULT_PANEL_HEIGHT = 40
const MIN_PANEL_HEIGHT = 15
const MAX_PANEL_HEIGHT = 85
const COLLAPSED_HEIGHT = 48
const TABS = [
  { id: 'body', label: 'Body', icon: Code },
  { id: 'headers', label: 'Headers', icon: List },
  { id: 'cookies', label: 'Cookies', icon: Cookie },
]
const BODY_MODES = ['pretty', 'raw', 'preview']

// Syntax highlighter for JSON
const syntaxHighlight = (json) => {
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="json-key">${match.slice(0, -1)}</span>:`
      } else if (/true|false/.test(match)) {
        return `<span class="json-boolean">${match}</span>`
      } else if (/null/.test(match)) {
        return `<span class="json-null">${match}</span>`
      } else if (/^-?\d+/.test(match)) {
        return `<span class="json-number">${match}</span>`
      }
      return `<span class="json-string">${match}</span>`
    }
  )
}

// Copy Button Component
function CopyButton({ content }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = typeof content === 'object' ? JSON.stringify(content, null, 2) : content
    navigator.clipboard.writeText(text).catch(err => console.warn('Copy failed:', err))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all duration-200"
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// Tab Button Component
function TabButton({ id, label, icon: Icon, count, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 relative ${
        active
          ? 'bg-background shadow-lg text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {count > 0 && (
        <span className={`rounded-full px-1.5 py-0 text-[10px] font-semibold transition-all ${
          active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {count}
        </span>
      )}
      {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />}
    </button>
  )
}

// Body Mode Toggle Button
function ModeButton({ mode, currentMode, icon: Icon, label, onClick }) {
  const isActive = mode === currentMode
  return (
    <button
      onClick={() => onClick(mode)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        isActive ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

// Resizable Divider
function ResizableDivider({ onDrag, isDragging, onDoubleClick }) {
  return (
    <div
      className={`relative group cursor-row-resize hover:bg-primary/20 transition-colors ${isDragging ? 'bg-primary/30' : 'bg-transparent'}`}
      style={{ height: '6px' }}
      onMouseDown={onDrag}
      onDoubleClick={onDoubleClick}
    >
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className={`w-16 h-1 rounded-full ${isDragging ? 'bg-primary' : 'bg-border'}`} />
      </div>
    </div>
  )
}

// Empty State
function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in-50 duration-300">
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-muted/20 to-muted/5 p-5 ring-1 ring-border/50">
        <Icon className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1.5 text-xs text-muted-foreground/50 max-w-xs">{subtitle}</p>
    </div>
  )
}

// Response Content Renderer
function ResponseContent({ response, bodyMode, detectedType, jsonData, isValidJSON, rawResponse }) {
  if (!response) {
    return <EmptyState icon={FileText} title="No response data" subtitle="Send a request to see the response here" />
  }

  if (bodyMode === 'pretty') {
    return (
      <div className="p-5 font-mono text-sm json-tree-wrapper">
        {isValidJSON ? (
          <JsonView data={jsonData} shouldExpandNode={(level) => level < 2} />
        ) : (
          <pre
            className="whitespace-pre-wrap break-words leading-relaxed"
            dangerouslySetInnerHTML={{ __html: syntaxHighlight(rawResponse) }}
          />
        )}
      </div>
    )
  }

  if (bodyMode === 'raw') {
    return <pre className="p-5 font-mono text-xs whitespace-pre-wrap break-words text-foreground/90 leading-relaxed">{rawResponse}</pre>
  }

  // Preview mode
  if (detectedType === 'html') {
    return <iframe srcDoc={response} title="Response Preview" className="h-full w-full border-none" sandbox="allow-scripts" />
  }
  if (detectedType === 'image') {
    return (
      <div className="flex items-center justify-center p-8 min-h-full">
        <img src={response} alt="Response" className="max-w-full h-auto shadow-2xl rounded-lg border border-border/50" />
      </div>
    )
  }
  return null
}

export const ResponsePanel = memo(function ResponsePanel({ response, status, responseTime, responseHeaders, responseCookies, responseSize }) {
  // Error detection
  const isError = status === 'Error' || (response && (response.startsWith('Error:') || response.startsWith('Network Error')))
  const errorObj = isError ? parseError(response) : null
  const errorConfig = errorObj ? getErrorConfig(errorObj) : null

  // Panel state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const [mainTab, setMainTab] = useState('body')
  const [bodyMode, setBodyMode] = useState('pretty')

  // Refs
  const containerRef = useRef(null)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)

  // Derived values
  const detectedType = useMemo(() => detectContentType(response, responseHeaders), [response, responseHeaders])
  const hasPreview = detectedType === 'html' || detectedType === 'image'
  const jsonData = useMemo(() => tryParseJSON(response), [response])
  const isValidJSON = jsonData !== null
  const rawResponse = useMemo(() => {
    if (typeof response === 'string') return response
    return JSON.stringify(response, null, 2)
  }, [response])

  // Headers & Cookies
  const headerEntries = useMemo(() => normalizeHeaders(responseHeaders), [responseHeaders])
  const cookies = useMemo(() => {
    if (responseCookies?.length) return responseCookies
    const setCookieHeaders = Array.isArray(responseHeaders)
      ? responseHeaders.filter(h => h.key.toLowerCase() === 'set-cookie').map(h => h.value)
      : Object.entries(responseHeaders || {}).find(([k]) => k.toLowerCase() === 'set-cookie')?.[1] || []
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean)
    return headers.map(parseCookieString)
  }, [responseCookies, responseHeaders])

  // Reset tab on new response
  useEffect(() => {
    setMainTab('body')
    setBodyMode('pretty')
  }, [response])

  // Drag handlers
  const handleDragStart = useCallback((e) => {
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight

    const handleMouseMove = (e) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.parentElement.getBoundingClientRect()
      const deltaY = dragStartY.current - e.clientY
      const deltaPercent = (deltaY / containerRect.height) * 100
      const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, dragStartHeight.current + deltaPercent))
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelHeight])

  const handleDoubleClick = useCallback(() => setPanelHeight(DEFAULT_PANEL_HEIGHT), [])
  const toggleFullscreen = useCallback(() => setIsFullscreen(p => !p), [])
  const toggleCollapse = useCallback(() => setIsCollapsed(p => !p), [])

  // Panel style
  // The panel is a flex child of a column whose own height comes from `flex-1`,
  // so a percentage flex-basis has no definite parent height to resolve against
  // and collapses to the header. Measuring the parent and basing off pixels
  // keeps the drag handle and the collapse toggle honest.
  const panelStyle = useMemo(() => {
    if (isFullscreen) return { position: 'fixed', inset: 0, zIndex: 50 }
    if (isCollapsed) return { flex: `0 0 ${COLLAPSED_HEIGHT}px`, minHeight: `${COLLAPSED_HEIGHT}px` }
    return { flex: `0 0 ${panelHeight}%`, minHeight: `${COLLAPSED_HEIGHT}px` }
  }, [isFullscreen, isCollapsed, panelHeight])

  // Table columns
  const headersColumns = [
    { header: 'Name', key: 'name', width: 'w-2/5', cellClassName: 'font-medium text-primary/80 align-top whitespace-nowrap' },
    { header: 'Value', key: 'value', cellClassName: 'break-all' },
  ]

  const cookiesColumns = [
    { header: 'Name', key: 'name', cellClassName: 'font-medium text-primary/80 whitespace-nowrap', nowrap: true },
    { header: 'Value', render: (c) => <span className="max-w-[180px] truncate" title={c.value}>{c.value || '—'}</span> },
    { header: 'Domain', key: 'domain', cellClassName: 'whitespace-nowrap', render: (c) => c.domain || '—' },
    { header: 'Path', key: 'path', cellClassName: 'whitespace-nowrap', render: (c) => c.path || '/' },
    { header: 'Expires', key: 'expires', cellClassName: 'whitespace-nowrap', render: (c) => c.expires || 'Session' },
    { header: 'Secure', render: (c) => (
      <div className="flex justify-center">{c.secure ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5 text-muted-foreground/30" strokeWidth={2} />}</div>
    )},
    { header: 'HttpOnly', render: (c) => (
      <div className="flex justify-center">{c.httpOnly ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} /> : <Minus className="h-3.5 w-3.5 text-muted-foreground/30" strokeWidth={2} />}</div>
    )},
  ]

  return (
    <>
      {!isFullscreen && !isCollapsed && (
        <ResizableDivider onDrag={handleDragStart} isDragging={isDragging} onDoubleClick={handleDoubleClick} />
      )}

      <div
        ref={containerRef}
        className={`flex flex-col bg-background/95 backdrop-blur-xl border-t border-border/60 transition-all duration-300 ease-out ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        style={panelStyle}
      >
        {/* Header Bar */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-muted/10 to-transparent px-4 py-2.5">
          <div className="flex items-center gap-2.5 shrink-0">
            <button onClick={toggleCollapse} className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={isCollapsed ? "Expand" : "Collapse"}>
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Response</span>

            {status && <Badge variant={getStatusVariant(status)} className="font-mono text-[11px] font-semibold px-2">{status}</Badge>}
            {isError && errorConfig && (
              <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${errorConfig.bg} ${errorConfig.color} ${errorConfig.border} border`}>
                {errorConfig.title}
              </Badge>
            )}

            <div className="h-4 w-px bg-border/40" />
            {responseSize && (
              <span className="text-[11px] text-muted-foreground/60 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />{formatSize(responseSize)}
              </span>
            )}
            {responseTime != null && (
              <span className="text-[11px] text-muted-foreground/60 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success/40" />{responseTime}ms
              </span>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center rounded-xl bg-muted/40 p-1 ring-1 ring-border/30">
              {TABS.map(tab => (
                <TabButton
                  key={tab.id}
                  id={tab.id}
                  label={tab.label}
                  icon={tab.icon}
                  count={tab.id === 'headers' ? headerEntries.length : tab.id === 'cookies' ? cookies.length : 0}
                  active={mainTab === tab.id}
                  onClick={setMainTab}
                />
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {!isCollapsed && mainTab === 'body' && response && <CopyButton content={response} />}
            <button onClick={toggleFullscreen} className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all duration-200" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Body Mode Toggles */}
        {!isCollapsed && mainTab === 'body' && !isError && response && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/5">
            <div className="flex items-center rounded-lg bg-muted/30 p-0.5">
              <ModeButton mode="pretty" currentMode={bodyMode} icon={Braces} label="Pretty" onClick={setBodyMode} />
              <ModeButton mode="raw" currentMode={bodyMode} icon={FileText} label="Raw" onClick={setBodyMode} />
              {hasPreview && <ModeButton mode="preview" currentMode={bodyMode} icon={Eye} label="Preview" onClick={setBodyMode} />}
            </div>
          </div>
        )}

        {/* Content */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden relative">
            {isError && errorObj ? (
              <div className={`h-full overflow-auto custom-scrollbar ${errorConfig.bg}`}>
                <div className="flex items-start gap-4 p-6">
                  <div className={`p-3 rounded-xl ${errorConfig.bg} flex-shrink-0 ring-1 ${errorConfig.border}`}>
                    <AlertTriangle className={`h-5 w-5 ${errorConfig.color}`} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-semibold ${errorConfig.color}`}>{errorConfig.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 break-words">{errorObj.message}</p>
                    {errorObj.details && (
                      <details className="mt-4">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Error details</summary>
                        <pre className="mt-2 text-xs bg-background/50 rounded p-3 overflow-x-auto">
                          {typeof errorObj.details === 'string' ? errorObj.details : JSON.stringify(errorObj.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ) : mainTab === 'body' ? (
              <div className="h-full overflow-auto custom-scrollbar">
                <ResponseContent
                  response={response}
                  bodyMode={bodyMode}
                  detectedType={detectedType}
                  jsonData={jsonData}
                  isValidJSON={isValidJSON}
                  rawResponse={rawResponse}
                />
              </div>
            ) : mainTab === 'headers' ? (
              <DataTable columns={headersColumns} rows={headerEntries} emptyIcon={List} emptyTitle="No headers" emptySubtitle="Send a request to see response headers" />
            ) : (
              <DataTable columns={cookiesColumns} rows={cookies} emptyIcon={Cookie} emptyTitle="No cookies" emptySubtitle="The server didn't send any cookies" />
            )}
          </div>
        )}
      </div>

      {isFullscreen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" onClick={toggleFullscreen} />}
    </>
  )
})
