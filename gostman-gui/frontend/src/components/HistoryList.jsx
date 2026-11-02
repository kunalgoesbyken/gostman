import { Fragment, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Clock, Search, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { Select } from "./ui/select"
import { FeatureEmpty } from "./FeatureEmpty"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { PANE_SIDEBAR, focusPane } from "../lib/panes"
import { ORIENTATION, isFocusLost, moveFocus, tabStopOf } from "../lib/rovingFocus"
import { ALL_FOLDERS, ALL_TAGS, RANGES, RANGE_ANY, filterHistory, groupByDate } from "../lib/historyFilter"
import { buildCollectionTree, listFolders } from "../lib/collectionTree"
import { collectTags } from "../lib/tags"
import { formatDate } from "../lib/i18n/format"
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
  if (!step) {
    const date = formatDate(sentAt)
    return { short: date, spoken: HISTORY_TEXT.sentAgoSpoken.date(date) }
  }
  const count = Math.floor(elapsed / step.unit)
  return { short: HISTORY_TEXT.sentAgo[step.key](count), spoken: HISTORY_TEXT.sentAgoSpoken[step.key](count) }
}

function SentAt({ timestamp }) {
  const { short, spoken } = relativeTime(timestamp)
  return (
    <span className="shrink-0 pe-1 text-2xs group-focus-within:hidden group-hover:hidden">
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
    <li className="group flex h-7 items-center pe-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      <button
        type="button"
        data-history-entry={entry.id}
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onOpen(entry)}
        onFocus={() => onFocus(entry.id)}
        onKeyDown={removeOnKey}
        title={entry.url}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 ps-3 text-start"
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

const NO_FILTERS = { range: RANGE_ANY, folderId: ALL_FOLDERS, tag: ALL_TAGS }

function HistoryFilters({ filters, onChange, folderOptions, tags, isGrouped, onGroupedChange }) {
  const choose = (name) => (event) => onChange({ ...filters, [name]: event.target.value })
  return (
    <div className="flex flex-col gap-1 px-2 pb-1">
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <Select value={filters.range} onChange={choose("range")} aria-label={HISTORY_TEXT.range}>
            {RANGES.map((range) => <option key={range} value={range}>{HISTORY_TEXT.ranges[range]}</option>)}
          </Select>
        </div>
        <IconButton label={HISTORY_TEXT.groupByDate} icon={CalendarDays} variant="outline" aria-pressed={isGrouped} onClick={() => onGroupedChange(!isGrouped)} className="h-7 w-7 shrink-0" />
      </div>
      <div className="grid grid-cols-2 gap-1 empty:hidden">
        {folderOptions.length > 0 && (
          <Select value={filters.folderId} onChange={choose("folderId")} aria-label={HISTORY_TEXT.folder}>
            <option value={ALL_FOLDERS}>{HISTORY_TEXT.allFolders}</option>
            {folderOptions.map(({ folder, path }) => <option key={folder.id} value={folder.id}>{path.join(" / ")}</option>)}
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={filters.tag} onChange={choose("tag")} aria-label={HISTORY_TEXT.tag}>
            <option value={ALL_TAGS}>{HISTORY_TEXT.allTags}</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </Select>
        )}
      </div>
    </div>
  )
}

export const HistoryList = memo(function HistoryList({ entries, folders, actions }) {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState(NO_FILTERS)
  const [isGrouped, setIsGrouped] = useState(true)
  const [focusedId, setFocusedId] = useState(null)
  const listRef = useRef(null)
  const pendingFocusId = useRef(null)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)

  const shown = useMemo(() => filterHistory(entries, { query, ...filters }, folders, Date.now()), [entries, folders, query, filters])
  const groups = useMemo(() => (isGrouped ? groupByDate(shown, Date.now()) : [{ key: "", entries: shown }]), [shown, isGrouped])
  const folderOptions = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const tags = useMemo(() => collectTags(entries), [entries])

  const isSearching = query.trim() !== "" || Object.entries(NO_FILTERS).some(([name, none]) => filters[name] !== none)
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
      {entries.length > 0 && (
        <HistoryFilters filters={filters} onChange={setFilters} folderOptions={folderOptions} tags={tags} isGrouped={isGrouped} onGroupedChange={setIsGrouped} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <FeatureEmpty
            surface={isSearching ? undefined : "history"}
            icon={isSearching ? Search : Clock}
            title={isSearching ? TREE_TEXT.noResultsTitle : HISTORY_TEXT.emptyTitle}
            description={isSearching ? HISTORY_TEXT.noMatches : HISTORY_TEXT.emptyDescription}
          />
        ) : (
          <ul ref={listRef} aria-label={SIDEBAR_TEXT.history} onKeyDown={(event) => moveFocus(event, ENTRY_KEYS)} className="py-1">
            {groups.map((group) => (
              <Fragment key={group.key}>
                {group.key && <li className="px-3 pb-0.5 pt-2 text-2xs font-medium text-muted-foreground">{HISTORY_TEXT.groups[group.key]}</li>}
                {group.entries.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    isTabStop={entry.id === tabStop}
                    onOpen={actions.openHistoryEntry}
                    onDelete={removeEntry}
                    onFocus={setFocusedId}
                  />
                ))}
              </Fragment>
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
