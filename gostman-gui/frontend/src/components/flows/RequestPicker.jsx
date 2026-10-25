import { useMemo, useState } from "react"
import { FileQuestion } from "lucide-react"
import { Dialog, DialogHeader, DialogTitle } from "../ui/dialog"
import { EmptyState } from "../ui/emptyState"
import { MethodTag } from "../MethodTag"
import { SearchField } from "../SearchField"
import { FLOW_PICKER_TEXT as TEXT } from "../../lib/flowsText"
import { fuzzyScore } from "../../lib/fuzzy"
import { cn } from "../../lib/utils"

const STEPS = { ArrowDown: 1, ArrowUp: -1 }

function matching(catalog, query) {
  if (!query.trim()) return catalog
  return catalog
    .map((request) => ({ request, score: fuzzyScore(`${request.path} ${request.method} ${request.url}`, query) }))
    .filter(({ score }) => score !== null)
    .sort((first, second) => second.score - first.score)
    .map(({ request }) => request)
}

export function RequestPicker({ catalog, onChoose, onClose }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const shown = useMemo(() => matching(catalog, query), [catalog, query])
  const chosen = shown[Math.min(active, shown.length - 1)]

  const handleKeyDown = (event) => {
    if (STEPS[event.key] && shown.length > 0) {
      event.preventDefault()
      setActive((current) => (current + STEPS[event.key] + shown.length) % shown.length)
      return
    }
    if (event.key === "Enter" && chosen) {
      event.preventDefault()
      onChoose(chosen)
    }
  }

  return (
    <Dialog label={TEXT.title} onClose={onClose} className="h-[28rem] max-sm:h-full">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <SearchField value={query} onChange={(value) => { setQuery(value); setActive(0) }} placeholder={TEXT.search} onKeyDown={handleKeyDown} />
      <div className="min-h-[12rem] flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {shown.length === 0 ? (
          <EmptyState icon={FileQuestion} title={catalog.length === 0 ? TEXT.noRequests : TEXT.noMatch} description={catalog.length === 0 ? TEXT.noRequestsHint : ""} />
        ) : (
          <ul role="listbox" aria-label={TEXT.title}>
            {shown.map((request, position) => (
              <li key={request.id} role="option" aria-selected={request === chosen}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseMove={() => setActive(position)}
                  onClick={() => onChoose(request)}
                  className={cn("flex h-9 w-full items-center gap-2 px-3 text-start", request === chosen && "bg-accent")}
                >
                  <MethodTag method={request.method} className="w-12" />
                  <span className="min-w-0 truncate text-xs text-foreground" title={request.path}>{request.path}</span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground max-sm:hidden" title={request.url}>{request.url}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
