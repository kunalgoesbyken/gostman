import { Fragment, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Clock, Download, Search } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { FeatureEmpty } from "./FeatureEmpty"
import { RowMenuButton, menuOpener, rowMenuItems } from "./HistoryRowMenu"
import { JournalList } from "./JournalList"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { PANE_SIDEBAR, focusPane } from "../lib/panes"
import { ORIENTATION, isFocusLost, moveFocus, tabStopOf } from "../lib/rovingFocus"
import { currentTargetOf } from "../lib/historyIdentity"
import { STATUS_CLASSES, totalCallsOf } from "../lib/callHistory"
import { ALL_FOLDERS, ALL_STATUSES, ALL_TAGS, RANGES, RANGE_ANY, filterHistory, groupByDate, journalView } from "../lib/historyFilter"
import { buildCollectionTree, listFolders } from "../lib/collectionTree"
import { collectTags } from "../lib/tags"
import { formatDate, formatDateTime, formatNumber } from "../lib/i18n/format"
import { HISTORY_VIEWS, HISTORY_VIEW_JOURNAL, updatePreferences, usePreferences } from "../lib/preferences"
import { statusVariant } from "../lib/response"
import { isRemoveKey, isUndoKey } from "../lib/shortcuts"
import { HISTORY_TEXT, SIDEBAR_TEXT } from "../lib/sidebarText"
import { TREE_TEXT } from "../lib/treeText"
import { cn } from "../lib/utils"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const JOURNAL_PAGE = 200
const SEARCH_DEBOUNCE_MS = 150
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
    <span className="shrink-0 pe-1 text-2xs">
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
    <span className="shrink-0 font-mono text-2xs tabular-nums">
      <span aria-hidden="true">×{count}</span>
      <span className="sr-only">{HISTORY_TEXT.callCount(count)}</span>
    </span>
  )
}

function HistoryRow({ entry, isTabStop, isMenuOpen, onOpen, onDelete, onFocus, onOpenMenu, onCloseMenu }) {
  const callCount = entry.calls.length
  const target = { id: entry.id, entry, callIndex: null }
  const openMenu = menuOpener(target, onOpenMenu)
  const removeOnKey = (event) => {
    if (!isRemoveKey(event) || event.repeat) return
    event.preventDefault()
    onDelete(target)
  }

  return (
    <li
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
      <RowMenuButton name={entry.url} isOpen={isMenuOpen} onOpen={openMenu} onClose={onCloseMenu} />
    </li>
  )
}

const NO_FILTERS = { range: RANGE_ANY, folderId: ALL_FOLDERS, tag: ALL_TAGS, statusClass: ALL_STATUSES }

function HistoryFilters({ filters, onChange, folderOptions, tags, canGroup, isGrouped, onGroupedChange, view, onViewChange }) {
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
        {canGroup && <IconButton label={HISTORY_TEXT.groupByDate} icon={CalendarDays} variant="outline" aria-pressed={isGrouped} onClick={() => onGroupedChange(!isGrouped)} className="h-7 w-7 shrink-0" />}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Select value={filters.statusClass} onChange={choose("statusClass")} aria-label={HISTORY_TEXT.status}>
          <option value={ALL_STATUSES}>{HISTORY_TEXT.allStatuses}</option>
          {STATUS_CLASSES.map((name) => <option key={name} value={name}>{HISTORY_TEXT.calls.classes[name]}</option>)}
        </Select>
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
  const [pendingFocus, setPendingFocus] = useState(null)
  const listRef = useRef(null)
  const { historyView } = usePreferences()
  const isJournal = historyView === HISTORY_VIEW_JOURNAL
  const searchedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const searched = useMemo(() => ({ query: searchedQuery, ...filters }), [searchedQuery, filters])

  const journal = useMemo(() => (isJournal ? journalView(entries, searched, folders, Date.now()) : null), [isJournal, entries, searched, folders])
  const found = useMemo(() => (isJournal ? [] : filterHistory(entries, searched, folders, Date.now())), [isJournal, entries, searched, folders])
  const shownDays = useMemo(() => (journal ? journal.days(journalLimit) : []), [journal, journalLimit])
  const shown = useMemo(() => (journal ? shownDays.flatMap((day) => day.rows) : found), [journal, shownDays, found])
  const foundCount = journal ? journal.count : found.length
  const groups = useMemo(() => {
    if (isJournal) return []
    return isGrouped ? groupByDate(found, Date.now()) : [{ key: "", entries: found }]
  }, [isJournal, found, isGrouped])
  const folderOptions = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const tags = useMemo(() => collectTags(entries), [entries])
  const totalCalls = useMemo(() => totalCallsOf(entries), [entries])

  const isSearching = searchedQuery.trim() !== "" || Object.entries(NO_FILTERS).some(([name, none]) => filters[name] !== none)
  const tabStop = tabStopOf(shown.map((item) => item.id), focusedId)

  const menuTarget = useMemo(() => (menu ? currentTargetOf(entries, menu.target) : null), [menu, entries])

  const removeTarget = useCallback((stale) => {
    const target = currentTargetOf(entries, stale)
    if (!target) return
    const index = shown.findIndex((item) => item.id === target.id)
    if (index >= 0) setPendingFocus(index)
    if (target.callIndex === null) actions.removeHistoryEntry(target.entry.id)
    else actions.removeHistoryCall(target.entry.id, target.callIndex)
  }, [entries, shown, actions])

  const showMore = () => {
    setPendingFocus(shown.length)
    setJournalLimit(journalLimit + JOURNAL_PAGE)
  }

  useLayoutEffect(() => {
    if (pendingFocus === null) return
    setPendingFocus(null)
    const rows = [...(listRef.current?.querySelectorAll(ENTRY_KEYS.selector) ?? [])]
    const row = rows[Math.min(pendingFocus, rows.length - 1)]
    if (row) row.focus()
    else if (isFocusLost()) focusPane(PANE_SIDEBAR)
  }, [pendingFocus])

  const enterResultsOnArrow = (event) => {
    if (event.key !== "ArrowDown" || !tabStop) return
    event.preventDefault()
    listRef.current?.querySelector(entrySelector(tabStop))?.focus()
  }

  const undoOnKey = (event) => {
    if (isUndoKey(event) && actions.undoHistoryRemoval()) event.preventDefault()
  }

  const rowProps = {
    onOpen: actions.openHistoryEntry,
    onDelete: removeTarget,
    onFocus: setFocusedId,
    onOpenMenu: (target, position) => setMenu({ target, position }),
    onCloseMenu: () => setMenu(null),
  }

  return (
    <>
      <SearchField value={query} onChange={setQuery} onKeyDown={enterResultsOnArrow} placeholder={HISTORY_TEXT.search} />
      {entries.length > 0 && (
        <HistoryFilters
          filters={filters}
          onChange={setFilters}
          folderOptions={folderOptions}
          tags={tags}
          canGroup={!isJournal}
          isGrouped={isGrouped}
          onGroupedChange={setIsGrouped}
          view={historyView}
          onViewChange={(view) => updatePreferences({ historyView: view })}
        />
      )}
      {isJournal && isSearching && entries.length > 0 && (
        <p role="status" className="px-3 pb-1 text-2xs text-muted-foreground tabular-nums">
          {HISTORY_TEXT.journal.filtered({ shown: formatNumber(foundCount), total: formatNumber(totalCalls) })}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {foundCount === 0 ? (
          <FeatureEmpty
            surface={isSearching ? undefined : "history"}
            icon={isSearching ? Search : Clock}
            title={isSearching ? TREE_TEXT.noResultsTitle : HISTORY_TEXT.emptyTitle}
            description={isSearching ? HISTORY_TEXT.noMatches : HISTORY_TEXT.emptyDescription}
          />
        ) : (
          <ul ref={listRef} aria-label={SIDEBAR_TEXT.history} onKeyDown={(event) => { undoOnKey(event); moveFocus(event, ENTRY_KEYS) }} className="py-1">
            {isJournal ? (
              <JournalList days={shownDays} tabStop={tabStop} menuId={menuTarget?.id} {...rowProps} />
            ) : groups.map((group) => (
              <Fragment key={group.key}>
                {group.key && <li className="px-3 pb-0.5 pt-2 text-2xs font-medium text-muted-foreground">{HISTORY_TEXT.groups[group.key]}</li>}
                {group.entries.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} isTabStop={entry.id === tabStop} isMenuOpen={menuTarget?.id === entry.id} {...rowProps} />
                ))}
              </Fragment>
            ))}
          </ul>
        )}
        {isJournal && shown.length < foundCount && (
          <div className="flex flex-col items-center gap-1 px-3 pb-2">
            <p className="text-2xs text-muted-foreground">{HISTORY_TEXT.calls.shownRows({ shown: formatNumber(shown.length), total: formatNumber(foundCount) })}</p>
            <Button variant="ghost" size="sm" onClick={showMore}>{HISTORY_TEXT.showMore}</Button>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border px-3">
          <Button variant="ghost" size="sm" onClick={actions.clearHistory}>{HISTORY_TEXT.clear}</Button>
          {isJournal && foundCount > 0 && (
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => actions.exportCalls(journal.rows(Infinity))}><Download />{HISTORY_TEXT.calls.exportCsv}</Button>
          )}
        </div>
      )}
      {menuTarget && <ContextMenu position={menu.position} title="" items={rowMenuItems(menuTarget, actions, removeTarget)} onClose={() => setMenu(null)} />}
    </>
  )
})
