import { memo, useMemo, useState } from "react"
import { Clock, Search, X } from "lucide-react"
import { EmptyState } from "./ui/emptyState"
import { SearchField } from "./SearchField"
import { useAppStore } from "../store/appStore"
import { METHOD_COLORS } from "../lib/constants"
import { cn } from "../lib/utils"

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
    <div className="group flex h-7 items-center pr-1 text-xs text-foreground/80 hover:bg-accent/50">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        title={entry.url}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 text-left outline-none focus-visible:bg-accent/50"
      >
        <span className={cn("w-11 shrink-0 truncate font-mono text-[10px] font-semibold", METHOD_COLORS[entry.method] || "text-muted-foreground")}>
          {entry.method}
        </span>
        <span className="min-w-0 flex-1 truncate">{entry.url}</span>
        <span className="shrink-0 pl-1 text-[10px] text-muted-foreground group-focus-within:hidden group-hover:hidden">
          {formatRelativeTime(entry.timestamp)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        aria-label="Remove from history"
        title="Remove from history"
        className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted-foreground/20 hover:text-foreground focus-visible:bg-muted-foreground/20 group-focus-within:flex group-hover:flex"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchField value={query} onChange={setQuery} placeholder="Search history" />

      {shown.length === 0 ? (
        <EmptyState
          icon={isSearching ? Search : Clock}
          title={isSearching ? "No results" : "No history yet"}
          description={isSearching ? "No sent request matches" : "Sent requests appear here"}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-compact">
          {shown.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} onOpen={actions.openHistoryEntry} onDelete={deleteHistoryItem} />
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <button
          type="button"
          onClick={actions.clearHistory}
          className="border-t border-border/60 px-3 py-2 text-left text-xs text-muted-foreground outline-none hover:text-destructive focus-visible:text-destructive"
        >
          Clear history
        </button>
      )}
    </div>
  )
})
