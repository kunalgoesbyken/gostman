import { useMemo, useState } from "react"
import { FileQuestion, Workflow } from "lucide-react"
import { Dialog, DialogHeader, DialogTitle } from "../ui/dialog"
import { EmptyState } from "../ui/emptyState"
import { MethodTag } from "../MethodTag"
import { SearchField } from "../SearchField"
import { FLOW_PICKER_TEXT as TEXT } from "../../lib/flowsText"
import { fuzzyScore } from "../../lib/fuzzy"
import { cn } from "../../lib/utils"

const STEPS = { ArrowDown: 1, ArrowUp: -1 }

function matching(items, query, searchText) {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(searchText(item), query) }))
    .filter(({ score }) => score !== null)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item)
}

function Picker({ words, items, searchText, renderItem, onChoose, onClose }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const shown = useMemo(() => matching(items, query, searchText), [items, query, searchText])
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
    <Dialog label={words.title} onClose={onClose} className="h-[28rem] max-sm:h-full">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{words.title}</DialogTitle>
      </DialogHeader>
      <SearchField value={query} onChange={(value) => { setQuery(value); setActive(0) }} placeholder={words.search} onKeyDown={handleKeyDown} />
      <div className="min-h-[12rem] flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {shown.length === 0 ? (
          <EmptyState icon={FileQuestion} title={items.length === 0 ? words.empty : words.noMatch} description={items.length === 0 ? words.emptyHint : ""} />
        ) : (
          <ul role="listbox" aria-label={words.title}>
            {shown.map((item, position) => (
              <li key={item.id} role="option" aria-selected={item === chosen}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseMove={() => setActive(position)}
                  onClick={() => onChoose(item)}
                  className={cn("flex h-9 w-full items-center gap-2 px-3 text-start", item === chosen && "bg-accent")}
                >
                  {renderItem(item)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

const requestText = (request) => `${request.path} ${request.method} ${request.url}`

function RequestRow({ request }) {
  return (
    <>
      <MethodTag method={request.method} className="w-12" />
      <span className="min-w-0 truncate text-xs text-foreground" title={request.path}>{request.path}</span>
      <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground max-sm:hidden" title={request.url}>{request.url}</span>
    </>
  )
}

export function RequestPicker({ catalog, onChoose, onClose }) {
  const words = { title: TEXT.title, search: TEXT.search, noMatch: TEXT.noMatch, empty: TEXT.noRequests, emptyHint: TEXT.noRequestsHint }
  return <Picker words={words} items={catalog} searchText={requestText} renderItem={(request) => <RequestRow request={request} />} onChoose={onChoose} onClose={onClose} />
}

const flowText = (flow) => `${flow.name} ${flow.description || ""}`

function FlowRow({ flow }) {
  return (
    <>
      <Workflow aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-xs text-foreground" title={flow.name}>{flow.name}</span>
      <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground max-sm:hidden" title={flow.description}>{flow.description}</span>
    </>
  )
}

export function FlowPicker({ flows, onChoose, onClose }) {
  const words = { title: TEXT.flowTitle, search: TEXT.flowSearch, noMatch: TEXT.noFlowMatch, empty: TEXT.noFlows, emptyHint: TEXT.noFlowsHint }
  return <Picker words={words} items={flows} searchText={flowText} renderItem={(flow) => <FlowRow flow={flow} />} onChoose={onChoose} onClose={onClose} />
}
