import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import { SectionLabel } from "../ui/panel"
import { parseJSON } from "../../lib/dataUtils"
import { readStored, writeStored } from "../../lib/storage"
import { cn } from "../../lib/utils"

const COLLAPSED_KEY = "gostman.flowSections"

const readCollapsed = () => new Set(parseJSON(readStored(COLLAPSED_KEY) || "", []))

function useCollapsed(key) {
  const [isCollapsed, setCollapsed] = useState(() => Boolean(key) && readCollapsed().has(key))
  const toggle = () => {
    const collapsed = readCollapsed()
    if (isCollapsed) collapsed.delete(key)
    else collapsed.add(key)
    writeStored(COLLAPSED_KEY, JSON.stringify([...collapsed]))
    setCollapsed(!isCollapsed)
  }
  return [isCollapsed, toggle]
}

export function PanelSection({ id, title, aside, children }) {
  const [isCollapsed, toggle] = useCollapsed(id)
  const bodyId = useId()
  if (!title) {
    return <section className="flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0">{children}</section>
  }
  return (
    <section className="flex flex-col border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 pe-3">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          onClick={toggle}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 ps-3 text-start hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronDown aria-hidden="true" className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", isCollapsed && "-rotate-90 rtl:rotate-90")} />
          <SectionLabel>{title}</SectionLabel>
        </button>
        {aside}
      </div>
      {!isCollapsed && <div id={bodyId} className="flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </section>
  )
}
