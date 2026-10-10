import { memo, useMemo, useState } from "react"
import { Clock, Search, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { MethodTag } from "./MethodTag"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

function formatRelativeTime(isoString) {
  const sentAt = new Date(isoString)
  const elapsed = Date.now() - sentAt.getTime()
  if (elapsed < MINUTE_MS) return "now"
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)}d`
  return sentAt.toLocaleDateString()
}

function HistoryRow({ entry, onOpen, onDelete }) {
  return (
    <li className="group flex h-7 items-center pr-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        title={entry.url}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left"
      >
        <MethodTag method={entry.method} className="w-10" />
        <span className="min-w-0 flex-1 truncate">{entry.url}</span>
        <span className="shrink-0 pr-1 text-[11px] group-focus-within:hidden group-hover:hidden">
          {formatRelativeTime(entry.timestamp)}
        </span>
      </button>
      <IconButton
        label="Remove from history"
        icon={X}
        size="icon-xs"
        onClick={() => onDelete(entry.id)}
        className="hidden group-focus-within:inline-flex group-hover:inline-flex"
      />
    </li>
  )
}

export const HistoryList = memo(function HistoryList({ entries, actions }) {
  const [query, setQuery] = useState("")
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) => `${entry.method} ${entry.url}`.toLowerCase().includes(needle))
  }, [entries, query])

  const isSearching = query.trim() !== ""

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Search history" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <EmptyState
            icon={isSearching ? Search : Clock}
            title={isSearching ? "No results" : "No history yet"}
            description={isSearching ? "No sent request matches." : "Sent requests appear here."}
          />
        ) : (
          <ul aria-label="History" className="py-1">
            {shown.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} onOpen={actions.openHistoryEntry} onDelete={deleteHistoryItem} />
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <div className="flex h-10 shrink-0 items-center border-t border-border px-3">
          <Button variant="ghost" size="sm" onClick={actions.clearHistory}>Clear history</Button>
        </div>
      )}
    </>
  )
})
