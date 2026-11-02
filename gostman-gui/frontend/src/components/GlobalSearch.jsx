import { useEffect, useMemo, useRef, useState } from "react"
import { Search } from "lucide-react"
import { Badge } from "./ui/badge"
import { EmptyState } from "./ui/emptyState"
import { Notice } from "./ui/panel"
import { SearchField } from "./SearchField"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { isNarrowViewport } from "../lib/layout"
import { QUERY_DEBOUNCE_MS } from "../lib/globalSearchLimits"
import { TIMED_OUT, searchInWorker } from "../lib/globalSearchTask"
import { KIND_HISTORY, KIND_REQUEST, KIND_RESPONSE, buildDocuments } from "../lib/searchDocuments"
import { SEARCH_TEXT } from "../lib/searchText"
import { useAppStore } from "../store/appStore"

const IDLE = { status: "idle" }
const WORKING = { status: "working" }

function useSearchResults(query, sources) {
  const needsSearch = query.trim() !== ""
  const documents = useMemo(() => (needsSearch ? buildDocuments(sources) : []), [needsSearch, sources])
  const [state, setState] = useState(IDLE)

  useEffect(() => {
    if (!needsSearch) {
      setState(IDLE)
      return undefined
    }
    let isCurrent = true
    setState(WORKING)
    const settle = (next) => isCurrent && next && setState(next)
    searchInWorker(documents, query).then(
      (outcome) => settle(outcome && { status: "done", ...outcome }),
      (error) => settle({ status: error.message === TIMED_OUT ? "timedOut" : "failed", reason: error.message }),
    )
    return () => {
      isCurrent = false
    }
  }, [needsSearch, documents, query])

  return state
}

function Snippet({ hit }) {
  return (
    <p dir="auto" className="truncate font-mono text-2xs text-muted-foreground">
      <span className="me-1.5 font-sans text-muted-foreground">{SEARCH_TEXT.fields[hit.field]}</span>
      {hit.before}
      <mark className="rounded-sm bg-[hsl(var(--warning)/0.3)] text-foreground">{hit.hit}</mark>
      {hit.after}
    </p>
  )
}

function ResultRow({ result, onOpen }) {
  return (
    <li>
      <button type="button" data-search-result={result.key} onClick={() => onOpen(result)} className="flex w-full min-w-0 flex-col gap-0.5 border-b border-border px-3 py-2 text-start hover:bg-accent">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <Badge variant="outline" className="shrink-0 px-1 py-0">{SEARCH_TEXT.kinds[result.kind]}</Badge>
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">{result.subtitle}</span>
          <span dir="auto" className="min-w-0 truncate text-foreground">{result.title}</span>
        </span>
        {result.hits.map((hit, index) => <Snippet key={index} hit={hit} />)}
      </button>
    </li>
  )
}

function Outcome({ state, query, onOpen }) {
  if (state.status === "idle") return <EmptyState icon={Search} title={SEARCH_TEXT.label} description={SEARCH_TEXT.hint} />
  if (state.status === "working") return <p role="status" className="px-3 py-2 text-xs text-muted-foreground">{SEARCH_TEXT.searching}</p>
  if (state.status === "timedOut") return <Notice tone="warning">{SEARCH_TEXT.timedOut}</Notice>
  if (state.status === "failed") return <Notice tone="destructive">{SEARCH_TEXT.failed({ reason: state.reason })}</Notice>
  if (state.results.length === 0) return <EmptyState icon={Search} title={SEARCH_TEXT.none(query.trim())} />
  return (
    <>
      <p role="status" className="px-3 py-1.5 text-2xs text-muted-foreground">{SEARCH_TEXT.results(state.results.length)}</p>
      {state.truncated && <Notice tone="warning">{SEARCH_TEXT.truncated}</Notice>}
      <ul>{state.results.map((result) => <ResultRow key={result.key} result={result} onOpen={onOpen} />)}</ul>
    </>
  )
}

export function GlobalSearch({ requests, history, tabs, actions }) {
  const [query, setQuery] = useState("")
  const debounced = useDebouncedValue(query, QUERY_DEBOUNCE_MS)
  const request = useAppStore((state) => state.globalSearch)
  const inputWrap = useRef(null)
  const sources = useMemo(() => ({ requests, history, tabs }), [requests, history, tabs])
  const state = useSearchResults(debounced, sources)

  useEffect(() => {
    if (request.nonce === 0) return
    if (request.query) setQuery(request.query)
    requestAnimationFrame(() => inputWrap.current?.querySelector("input")?.focus())
  }, [request])

  const open = (result) => {
    if (result.kind === KIND_REQUEST) actions.openRequest(requests.find((item) => item.id === result.id))
    if (result.kind === KIND_HISTORY) actions.openHistoryEntry(history.find((item) => item.id === result.id))
    if (result.kind === KIND_RESPONSE) useAppStore.getState().jumpToResponse(result.id, debounced.trim())
    if (isNarrowViewport()) useAppStore.getState().closeSidebar()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={inputWrap}>
        <SearchField value={query} onChange={setQuery} placeholder={SEARCH_TEXT.placeholder} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outcome state={state} query={debounced} onOpen={open} />
      </div>
    </div>
  )
}
