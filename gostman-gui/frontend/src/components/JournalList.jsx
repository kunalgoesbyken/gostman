import { CallStatus } from "./CallStatus"
import { MethodTag } from "./MethodTag"
import { RowMenuButton, menuOpener } from "./HistoryRowMenu"
import { callLabel, durationText, requestNameOf, sizeText } from "../lib/callDisplay"
import { timeOf } from "../lib/callHistory"
import { formatDate, formatTime } from "../lib/i18n/format"
import { isRemoveKey } from "../lib/shortcuts"
import { HISTORY_TEXT } from "../lib/sidebarText"
import { cn } from "../lib/utils"

const DAY_OPTIONS = { weekday: "short", day: "numeric", month: "short" }

function JournalRow({ row, isTabStop, isMenuOpen, onOpen, onDelete, onFocus, onOpenMenu, onCloseMenu }) {
  const { entry, call } = row
  const target = { id: row.id, entry, callIndex: row.index }
  const openMenu = menuOpener(target, onOpenMenu)
  const removeOnKey = (event) => {
    if (!isRemoveKey(event)) return
    event.preventDefault()
    onDelete(target)
  }

  return (
    <li
      onContextMenu={openMenu}
      className={cn("group flex h-11 items-center pe-1.5 text-xs hover:bg-accent hover:text-foreground", isMenuOpen ? "bg-accent text-foreground" : "text-muted-foreground")}
    >
      <button
        type="button"
        data-history-entry={row.id}
        data-pane-entry
        tabIndex={isTabStop ? 0 : -1}
        onClick={() => onOpen(entry)}
        onFocus={() => onFocus(row.id)}
        onKeyDown={removeOnKey}
        title={`${entry.url}\n${callLabel(call)}`}
        className="flex h-full min-w-0 flex-1 flex-col justify-center gap-0.5 ps-3 text-start"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-mono text-2xs tabular-nums">{formatTime(new Date(timeOf(call)))}</span>
          <MethodTag compact method={entry.method} className="w-10" />
          <span className="min-w-0 flex-1 truncate">{requestNameOf(entry)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-2xs tabular-nums">
          <CallStatus call={call} />
          {call.durationMs !== null && <span className="shrink-0">{durationText(call.durationMs)}</span>}
          {call.size !== null && <span className="shrink-0">{sizeText(call.size)}</span>}
        </span>
      </button>
      <RowMenuButton name={requestNameOf(entry)} isOpen={isMenuOpen} onOpen={openMenu} onClose={onCloseMenu} />
    </li>
  )
}

function dayTitle(day) {
  const date = formatDate(new Date(day.day), DAY_OPTIONS)
  return day.relative ? HISTORY_TEXT.journal.dayWithRelative({ relative: HISTORY_TEXT.groups[day.relative], date }) : date
}

export function JournalList({ days, tabStop, menuId, onOpen, onDelete, onFocus, onOpenMenu, onCloseMenu }) {
  return days.map((day) => (
    <li key={day.day}>
      <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-1 text-2xs font-medium text-muted-foreground">
        <span className="truncate">{dayTitle(day)}</span>
        <span className="shrink-0 tabular-nums">{HISTORY_TEXT.callCount(day.count)}</span>
      </h3>
      <ul>
        {day.rows.map((row) => (
          <JournalRow
            key={row.id}
            row={row}
            isTabStop={row.id === tabStop}
            isMenuOpen={menuId === row.id}
            onOpen={onOpen}
            onDelete={onDelete}
            onFocus={onFocus}
            onOpenMenu={onOpenMenu}
            onCloseMenu={onCloseMenu}
          />
        ))}
      </ul>
    </li>
  ))
}
