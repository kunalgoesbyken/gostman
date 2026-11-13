import { Fragment, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { BarChart3, CalendarDays, Clock, Download, MoreHorizontal, Search, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { CallStatus } from "./CallStatus"
import { FeatureEmpty } from "./FeatureEmpty"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { PANE_SIDEBAR, focusPane } from "../lib/panes"
import { ORIENTATION, isFocusLost, moveFocus, tabStopOf } from "../lib/rovingFocus"
import { timeOf } from "../lib/callHistory"
import { callLabel, durationText, shortMomentText } from "../lib/callDisplay"
import { ALL_FOLDERS, ALL_TAGS, RANGES, RANGE_ANY, filterHistory, groupByDate, journalOf } from "../lib/historyFilter"
import { buildCollectionTree, listFolders } from "../lib/collectionTree"
import { collectTags } from "../lib/tags"
import { formatDate, formatDateTime, formatNumber } from "../lib/i18n/format"
import { HISTORY_VIEWS, HISTORY_VIEW_JOURNAL, updatePreferences, usePreferences } from "../lib/preferences"
import { statusVariant } from "../lib/response"
import { isRemoveKey } from "../lib/shortcuts"
import { HISTORY_TEXT, SIDEBAR_TEXT } from "../lib/sidebarText"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const JOURNAL_PAGE = 200
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
    <span className="shrink-0 pe-1 text-2xs group-focus-within:hidden group-hover:hidden group-data-[menu-open]:hidden">
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

function CallCount({ count }) {
  if (count < 2) return null
  return (
    <span className="shrink-0 font-mono text-2xs tabular-nums group-focus-within:hidden group-hover:hidden group-data-[menu-open]:hidden">
      <span aria-hidden="true">×{count}</span>
      <span className="sr-only">{HISTORY_TEXT.callCount(count)}</span>
    </span>
  )
}

function HistoryRow({ entry, isTabStop, isMenuOpen, onOpen, onDelete, onFocus, onOpenMenu, onCloseMenu }) {
  const callCount = entry.calls.length
  const removeOnKey = (event) => {
    if (!isRemoveKey(event)) return
    event.preventDefault()
    onDelete(entry.id)
  }
  const openMenu = (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    onOpenMenu(entry.id, { x: event.clientX || rect.left, y: event.clientY || rect.bottom })
  }

  return (
    <li
      data-menu-open={isMenuOpen || undefined}
      onContextMenu={openMenu}
      className={cn("group flex h-7 items-center pe-1.5 text-xs hover:bg-accent hover:text-foreground", isMenuOpen ? "bg-accent text-foreground" : "text-muted-foreground")}
    >
      <button
        type="button"
        data-history-entry={entry.id}
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onOpen(entry)}
        onFocus={() => onFocus(entry.id)}
        onKeyDown={removeOnKey}
        title={`${entry.url}\n${HISTORY_TEXT.sentOn(formatDateTime(new Date(entry.timestamp)))} · ${HISTORY_TEXT.callCount(callCount)}`}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 ps-3 text-start"
      >
        <MethodTag compact method={entry.method} className="w-10" />
        <span className="min-w-0 flex-1 truncate">{entry.url}</span>
        <StatusMark entry={entry} />
        <CallCount count={callCount} />
        <SentAt timestamp={entry.timestamp} />
      </button>
      <IconButton
        label={HISTORY_TEXT.actions(entry.url)}
        icon={MoreHorizontal}
        size="icon-xs"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        onClick={isMenuOpen ? onCloseMenu : openMenu}
        className="hidden group-focus-within:inline-flex group-hover:inline-flex group-data-[menu-open]:inline-flex"
      />
    </li>
  )
}

function JournalRow({ row, isTabStop, onOpen, onFocus }) {
  const { entry, call } = row
  return (
    <li className="flex h-10 items-center text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      <button
        type="button"
        data-history-entry={row.id}
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onOpen(entry)}
        onFocus={() => onFocus(row.id)}
        title={`${entry.url}\n${callLabel(call)}`}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-3 text-start"
      >
        <MethodTag compact method={entry.method} className="w-10" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{entry.url}</span>
          <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-2xs tabular-nums">
            <span className="min-w-0 truncate">{shortMomentText(timeOf(call))}</span>
            <CallStatus call={call} />
            {call.durationMs !== null && <span className="shrink-0">{durationText(call.durationMs)}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}

const rowMenuItems = (entryId, showCalls, remove) => [
  { id: "calls", label: HISTORY_TEXT.showCalls, icon: BarChart3, onSelect: () => showCalls(entryId) },
  { id: "remove", label: HISTORY_TEXT.remove, icon: Trash2, destructive: true, separated: true, onSelect: () => remove(entryId) },
]

const NO_FILTERS = { range: RANGE_ANY, folderId: ALL_FOLDERS, tag: ALL_TAGS }

function HistoryFilters({ filters, onChange, folderOptions, tags, isGrouped, onGroupedChange, view, onViewChange }) {
  const choose = (name) => (event) => onChange({ ...filters, [name]: event.target.value })
  return (
    <div className="flex flex-col gap-1 px-2 pb-1">
      <SegmentedControl
        label={HISTORY_TEXT.view}
        options={HISTORY_VIEWS.map((name) => ({ value: name, label: HISTORY_TEXT.views[name] }))}
        value={view}
        onChange={onViewChange}
      />
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
  const [menu, setMenu] = useState(null)
  const [journalLimit, setJournalLimit] = useState(JOURNAL_PAGE)
  const listRef = useRef(null)
  const pendingFocusId = useRef(null)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)
  const openCallHistory = useAppStore((s) => s.openCallHistory)
  const { historyView } = usePreferences()
  const isJournal = historyView === HISTORY_VIEW_JOURNAL

  const found = useMemo(
    () => (isJournal ? journalOf : filterHistory)(entries, { query, ...filters }, folders, Date.now()),
    [isJournal, entries, folders, query, filters],
  )
  const shown = useMemo(() => (isJournal ? found.slice(0, journalLimit) : found), [isJournal, found, journalLimit])
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
        <HistoryFilters filters={filters} onChange={setFilters} folderOptions={folderOptions} tags={tags} isGrouped={isGrouped} onGroupedChange={setIsGrouped} view={historyView} onViewChange={(view) => updatePreferences({ historyView: view })} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {found.length === 0 ? (
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
                {group.entries.map((item) => (isJournal ? (
                  <JournalRow key={item.id} row={item} isTabStop={item.id === tabStop} onOpen={actions.openHistoryEntry} onFocus={setFocusedId} />
                ) : (
                  <HistoryRow
                    key={item.id}
                    entry={item}
                    isTabStop={item.id === tabStop}
                    isMenuOpen={menu?.entryId === item.id}
                    onOpen={actions.openHistoryEntry}
                    onDelete={removeEntry}
                    onFocus={setFocusedId}
                    onOpenMenu={(entryId, position) => setMenu({ entryId, position })}
                    onCloseMenu={() => setMenu(null)}
                  />
                )))}
              </Fragment>
            ))}
          </ul>
        )}
        {shown.length < found.length && (
          <div className="flex flex-col items-center gap-1 px-3 pb-2">
            <p className="text-2xs text-muted-foreground">{HISTORY_TEXT.calls.shownRows({ shown: formatNumber(shown.length), total: formatNumber(found.length) })}</p>
            <Button variant="ghost" size="sm" onClick={() => setJournalLimit(journalLimit + JOURNAL_PAGE)}>{HISTORY_TEXT.showMore}</Button>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border px-3">
          <Button variant="ghost" size="sm" onClick={actions.clearHistory}>{HISTORY_TEXT.clear}</Button>
          {isJournal && found.length > 0 && (
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => actions.exportCalls(found)}><Download />{HISTORY_TEXT.calls.exportCsv}</Button>
          )}
        </div>
      )}
      {menu && <ContextMenu position={menu.position} title="" items={rowMenuItems(menu.entryId, openCallHistory, removeEntry)} onClose={() => setMenu(null)} />}
    </>
  )
})
