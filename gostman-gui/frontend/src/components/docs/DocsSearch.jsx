import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Close, Search } from "../landing/icons"
import { DOCS_TEXT } from "../../lib/docsText"
import { classes } from "../../docs/classes"
import { highlight, prepareIndex, searchIndex, snippet, termsOf } from "../../docs/search"

let indexRequest = null

function loadIndex(url) {
  indexRequest ??= fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(response.statusText)
      return response.json()
    })
    .then(prepareIndex)
    .catch((error) => {
      indexRequest = null
      throw error
    })
  return indexRequest
}

function useIndex(url) {
  const [state, setState] = useState({ index: null, failed: false })
  useEffect(() => {
    let live = true
    loadIndex(url).then(
      (index) => live && setState({ index, failed: false }),
      () => live && setState({ index: null, failed: true }),
    )
    return () => {
      live = false
    }
  }, [url])
  return state
}

function Highlighted({ text, terms }) {
  return highlight(text, terms).map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-sm bg-primary/15 text-foreground">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  )
}

const suggestionsOf = (nav) => nav[0].items.map((item) => ({ title: item.label, section: "", href: item.href, text: "" }))

function Option({ result, id, active, terms, onPick, onHover }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onClick={() => onPick(result)}
      onMouseMove={onHover}
      className={classes("cursor-pointer rounded-md px-3 py-2", active && "bg-muted")}
    >
      {result.section ? <p className="truncate text-xs text-muted-foreground">{result.title}</p> : null}
      <p className="truncate text-sm font-medium text-foreground">
        <Highlighted text={result.section || result.title} terms={terms} />
      </p>
      {result.text ? (
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          <Highlighted text={snippet(result.text, terms)} terms={terms} />
        </p>
      ) : null}
    </li>
  )
}

function Hints() {
  return (
    <div className="flex gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground max-sm:hidden">
      <span><kbd>↵</kbd> {DOCS_TEXT.search.hints.open}</span>
      <span><kbd>↑</kbd> <kbd>↓</kbd> {DOCS_TEXT.search.hints.move}</span>
      <span><kbd>Esc</kbd> {DOCS_TEXT.search.hints.close}</span>
    </div>
  )
}

function statusOf({ query, index, failed, results }) {
  if (failed) return DOCS_TEXT.search.failed
  if (!query.trim()) return ""
  if (!index) return DOCS_TEXT.search.loading
  return results.length ? DOCS_TEXT.search.count(results.length) : DOCS_TEXT.search.empty(query.trim())
}

export default function DocsSearch({ url, nav, onClose }) {
  const { index, failed } = useIndex(url)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  const listId = useId()
  const terms = useMemo(() => termsOf(query), [query])
  const results = useMemo(() => (terms.length ? (index ? searchIndex(index, query) : []) : suggestionsOf(nav)), [index, query, terms, nav])
  const status = statusOf({ query, index, failed, results: terms.length ? results : [] })
  const optionId = (at) => `${listId}-${at}`

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active, results])

  const pick = (result) => {
    window.location.assign(result.href)
    onClose()
  }

  const onKeyDown = (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
    if (step && results.length) {
      event.preventDefault()
      setActive((current) => (current + step + results.length) % results.length)
    }
    if (event.key === "Enter" && results[active]) {
      event.preventDefault()
      pick(results[active])
    }
  }

  return (
    <div className="flex max-h-[min(36rem,76dvh)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-label={DOCS_TEXT.search.label}
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(active) : undefined}
          placeholder={DOCS_TEXT.search.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none sm:text-sm"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={DOCS_TEXT.search.close}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Close className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-3 pb-1 pt-1 text-xs font-medium text-muted-foreground">
          {terms.length ? DOCS_TEXT.search.results : DOCS_TEXT.search.suggestions}
        </p>
        <p role="status" className={classes("px-3 py-2 text-sm text-muted-foreground", (!status || results.length > 0) && "sr-only")}>
          {status}
        </p>
        <ul ref={listRef} id={listId} role="listbox" aria-label={DOCS_TEXT.search.results} className="space-y-0.5">
          {results.map((result, at) => (
            <Option
              key={result.href}
              id={optionId(at)}
              result={result}
              active={at === active}
              terms={terms}
              onPick={pick}
              onHover={() => setActive(at)}
            />
          ))}
        </ul>
      </div>
      <Hints />
    </div>
  )
}
