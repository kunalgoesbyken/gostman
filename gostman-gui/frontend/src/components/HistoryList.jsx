import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Clock, Search, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { PANE_SIDEBAR, focusPane } from "../lib/panes"
import { ORIENTATION, isFocusLost, moveFocus, tabStopOf } from "../lib/rovingFocus"
import { statusVariant } from "../lib/response"
import { isRemoveKey } from "../lib/shortcuts"
import { HISTORY_TEXT, SIDEBAR_TEXT } from "../lib/sidebarText"
import { TREE_TEXT } from "../lib/treeText"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const ENTRY_KEYS = { selector: "[data-history-entry]", orientation: ORIENTATION.vertical }

const entrySelector = (id) => `[data-history-entry="${CSS.escape(id)}"]`

const AGE_STEPS = [
  { below: HOUR_MS, unit: MINUTE_MS, key: "minutes" },
  { below: DAY_MS, unit: HOUR_MS, key: "hours" },
  { below: WEEK_MS, unit: DAY_MS, key: "days" },
]

function relativeTime(isoString) {
  const sentAt = new Date(isoString)
  const elapsed = Date.now() - sentAt.getTime()
  if (elapsed < MINUTE_MS) return { short: HISTORY_TEXT.sentAgo.now, spoken: HISTORY_TEXT.sentAgoSpoken.now }
  const step = AGE_STEPS.find(({ below }) => elapsed < below)
  if (!step) return { short: sentAt.toLocaleDateString(), spoken: HISTORY_TEXT.sentAgoSpoken.date(sentAt.toLocaleDateString()) }
  const count = Math.floor(elapsed / step.unit)
  return { short: HISTORY_TEXT.sentAgo[step.key](count), spoken: HISTORY_TEXT.sentAgoSpoken[step.key](count) }
}

function SentAt({ timestamp }) {
  const { short, spoken } = relativeTime(timestamp)
  return (
    <span className="shrink-0 pr-1 text-2xs group-focus-within:hidden group-hover:hidden">
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}

function StatusMark({ entry }) {
  if (entry.statusCode > 0) return <Badge variant={statusVariant(entry)} className="px-1 py-0 font-mono">{entry.statusCode}</Badge>
  if (entry.noResponse) return <Badge variant="serverError" className="px-1 py-0">{HISTORY_TEXT.noResponse}</Badge>
  return null
}

function HistoryRow({ entry, isTabStop, onOpen, onDelete, onFocus }) {
  const removeOnKey = (event) => {
    if (!isRemoveKey(event)) return
    event.preventDefault()
    onDelete(entry.id)
  }

  return (
    <li className="group flex h-7 items-center pr-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      <button
        type="button"
        data-history-entry={entry.id}
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onOpen(entry)}
        onFocus={() => onFocus(entry.id)}
        onKeyDown={removeOnKey}
        title={entry.url}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left"
      >
        <MethodTag compact method={entry.method} className="w-10" />
        <span className="min-w-0 flex-1 truncate">{entry.url}</span>
        <StatusMark entry={entry} />
        <SentAt timestamp={entry.timestamp} />
      </button>
      <IconButton
        label={HISTORY_TEXT.remove}
        icon={X}
        size="icon-xs"
        tabIndex={-1}
        onClick={() => onDelete(entry.id)}
        className="hidden group-focus-within:inline-flex group-hover:inline-flex"
      />
    </li>
  )
}

export const HistoryList = memo(function HistoryList({ entries, actions }) {
  const [query, setQuery] = useState("")
  const [focusedId, setFocusedId] = useState(null)
  const listRef = useRef(null)
  const pendingFocusId = useRef(null)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) => `${entry.method} ${entry.url} ${entry.statusCode || ""}`.toLowerCase().includes(needle))
  }, [entries, query])

  const isSearching = query.trim() !== ""
  const tabStop = tabStopOf(shown.map((entry) => entry.id), focusedId)

  const removeEntry = useCallback((id) => {
    const index = shown.findIndex((entry) => entry.id === id)
    const neighbour = shown[index + 1] || shown[index - 1]
    pendingFocusId.current = neighbour?.id ?? ""
    if (neighbour) setFocusedId(neighbour.id)
    deleteHistoryItem(id)
  }, [shown, deleteHistoryItem])

  useLayoutEffect(() => {
    if (pendingFocusId.current === null) return
    const neighbour = pendingFocusId.current && listRef.current?.querySelector(entrySelector(pendingFocusId.current))
    pendingFocusId.current = null
    if (neighbour) neighbour.focus()
    else if (isFocusLost()) focusPane(PANE_SIDEBAR)
  })

  const enterResultsOnArrow = (event) => {
    if (event.key !== "ArrowDown" || !tabStop) return
    event.preventDefault()
    listRef.current?.querySelector(entrySelector(tabStop))?.focus()
  }

  return (
    <>
      <SearchField value={query} onChange={setQuery} onKeyDown={enterResultsOnArrow} placeholder={HISTORY_TEXT.search} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <EmptyState
            icon={isSearching ? Search : Clock}
            title={isSearching ? TREE_TEXT.noResultsTitle : HISTORY_TEXT.emptyTitle}
            description={isSearching ? HISTORY_TEXT.noMatches : HISTORY_TEXT.emptyDescription}
          />
        ) : (
          <ul ref={listRef} aria-label={SIDEBAR_TEXT.history} onKeyDown={(event) => moveFocus(event, ENTRY_KEYS)} className="py-1">
            {shown.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                isTabStop={entry.id === tabStop}
                onOpen={actions.openHistoryEntry}
                onDelete={removeEntry}
                onFocus={setFocusedId}
              />
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex h-10 shrink-0 items-center border-t border-border px-3">
          <Button variant="ghost" size="sm" onClick={actions.clearHistory}>{HISTORY_TEXT.clear}</Button>
        </div>
      )}
    </>
  )
})
