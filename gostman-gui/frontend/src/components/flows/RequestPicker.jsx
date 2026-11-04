import { useMemo, useState } from "react"
import { FileQuestion, Folder, Workflow } from "lucide-react"
import { Dialog, DialogHeader, DialogTitle } from "../ui/dialog"
import { EmptyState } from "../ui/emptyState"
import { MethodTag } from "../MethodTag"
import { SearchField } from "../SearchField"
import { toolWindow } from "../../lib/dialogWindows"
import { FLOW_PICKER_TEXT as TEXT } from "../../lib/flowsText"
import { fuzzyScore } from "../../lib/fuzzy"
import { cn } from "../../lib/utils"

const STEPS = { ArrowDown: 1, ArrowUp: -1 }
const REQUEST_WINDOW = toolWindow("flow-request-picker", "compact")
const FLOW_WINDOW = toolWindow("flow-flow-picker", "compact")
const UNGROUPED = ""

function matching(items, query, searchText) {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(searchText(item), query) }))
    .filter(({ score }) => score !== null)
    .sort((first, second) => second.score - first.score)
    .map(({ item }) => item)
}

function grouped(items, groupOf) {
  if (!groupOf) return [{ key: UNGROUPED, label: "", items }]
  const groups = new Map()
  items.forEach((item) => {
    const group = groupOf(item)
    if (!groups.has(group.key)) groups.set(group.key, { ...group, items: [] })
    groups.get(group.key).items.push(item)
  })
  return [...groups.values()]
}

function GroupHeading({ group, count }) {
  return (
    <li role="presentation" className="sticky top-0 z-10 flex h-7 items-center gap-1.5 border-b border-border bg-background px-3 text-2xs font-medium text-muted-foreground">
      <Folder aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{group.label}</span>
      <span className="ms-auto shrink-0 tabular-nums">{count}</span>
    </li>
  )
}

function Picker({ words, items, searchText, groupOf, renderItem, floating, onChoose, onClose }) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const groups = useMemo(() => grouped(matching(items, query, searchText), groupOf), [items, query, searchText, groupOf])
  const ordered = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const chosen = ordered[Math.min(active, ordered.length - 1)]

  const handleKeyDown = (event) => {
    if (STEPS[event.key] && ordered.length > 0) {
      event.preventDefault()
      setActive((current) => (current + STEPS[event.key] + ordered.length) % ordered.length)
      return
    }
    if (event.key === "Enter" && chosen) {
      event.preventDefault()
      onChoose(chosen)
    }
  }

  return (
    <Dialog label={words.title} floating={floating} onClose={onClose} className="h-[28rem] max-sm:h-full">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{words.title}</DialogTitle>
      </DialogHeader>
      <SearchField value={query} onChange={(value) => { setQuery(value); setActive(0) }} placeholder={words.search} onKeyDown={handleKeyDown} />
      <div className="min-h-[12rem] flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {ordered.length === 0 ? (
          <EmptyState icon={FileQuestion} title={items.length === 0 ? words.empty : words.noMatch} description={items.length === 0 ? words.emptyHint : ""} />
        ) : (
          <ul role="listbox" aria-label={words.title}>
            {groups.map((group) => (
              <li key={group.key} role="presentation">
                <ul role="group" aria-label={group.label || undefined}>
                  {group.label && <GroupHeading group={group} count={group.items.length} />}
                  {group.items.map((item) => (
                    <li key={item.id} role="option" aria-selected={item === chosen}>
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseMove={() => setActive(ordered.indexOf(item))}
                        onClick={() => onChoose(item)}
                        className={cn("flex h-9 w-full items-center gap-2 px-3 text-start", group.label && "ps-6", item === chosen && "bg-accent")}
                      >
                        {renderItem(item)}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

const requestText = (request) => `${request.path} ${request.method} ${request.url}`

const collectionOf = (request) => ({ key: request.collectionId || UNGROUPED, label: request.collection || TEXT.noCollection })

function RequestRow({ request }) {
  return (
    <>
      <MethodTag method={request.method} className="w-12" />
      <span className="min-w-0 truncate text-xs text-foreground" title={request.path}>{request.place || request.name}</span>
      <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground max-sm:hidden" title={request.url}>{request.url}</span>
    </>
  )
}

export function RequestPicker({ catalog, onChoose, onClose }) {
  const words = { title: TEXT.title, search: TEXT.search, noMatch: TEXT.noMatch, empty: TEXT.noRequests, emptyHint: TEXT.noRequestsHint }
  return (
    <Picker
      words={words}
      items={catalog}
      searchText={requestText}
      groupOf={collectionOf}
      floating={REQUEST_WINDOW}
      renderItem={(request) => <RequestRow request={request} />}
      onChoose={onChoose}
      onClose={onClose}
    />
  )
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
  return <Picker words={words} items={flows} searchText={flowText} floating={FLOW_WINDOW} renderItem={(flow) => <FlowRow flow={flow} />} onChoose={onChoose} onClose={onClose} />
}
