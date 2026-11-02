import { memo, useMemo, useState } from "react"
import { X } from "lucide-react"
import { IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { ORIENTATION, moveFocus } from "../lib/rovingFocus"
import { TabMark } from "./TabMark"
import { isTabDirty, savedForTab, tabHint, tabTitle } from "../lib/tabDisplay"
import { TAB_BAR_TEXT as TEXT } from "../lib/tabBarText"
import { tabMenuItems } from "../lib/tabMenu"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const ROW_KEYS = { selector: "[data-open-tab]", orientation: ORIENTATION.vertical }

function OpenTabRow({ tab, saved, isActive, onSelect, onClose, onOpenMenu }) {
  const title = tabTitle(tab)
  const isDirty = isTabDirty(tab, saved)

  return (
    <li
      title={tabHint(tab)}
      onContextMenu={(event) => {
        event.preventDefault()
        onOpenMenu(tab.id, { x: event.clientX, y: event.clientY })
      }}
      className={cn("group flex items-center pe-1 text-xs", isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
    >
      <button
        type="button"
        data-open-tab={tab.id}
        aria-current={isActive ? "true" : undefined}
        tabIndex={isActive ? 0 : -1}
        onClick={() => onSelect(tab.id)}
        className="flex h-8 min-w-0 flex-1 items-center gap-1.5 ps-3 text-start"
      >
        <TabMark tab={tab} />
        <span className={cn("truncate", tab.isPreview && "italic")}>{title}</span>
        {isDirty && <span aria-label={TEXT.unsaved} className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />}
      </button>
      <IconButton label={TEXT.close(title)} icon={X} size="icon-xs" tabIndex={-1} onClick={() => onClose(tab.id)} className="hover:bg-muted" />
    </li>
  )
}

export const OpenTabsList = memo(function OpenTabsList({ tabs, activeTabId, requests, actions, onSelect, onClose }) {
  const flows = useAppStore((s) => s.flows)
  const besideTabId = useAppStore((s) => s.besideTabId)
  const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])
  const flowsById = useMemo(() => new Map(flows.map((flow) => [flow.id, flow])), [flows])
  const specs = useAppStore((s) => s.specs)
  const saved = useMemo(() => ({ requests: requestsById, flows: flowsById, specs: new Map(specs.map((spec) => [spec.id, spec])) }), [requestsById, flowsById, specs])
  const [menu, setMenu] = useState(null)
  const menuTab = menu && tabs.find((candidate) => candidate.id === menu.tabId)

  return (
    <>
      <ul aria-label={TEXT.openRequests} onKeyDown={(event) => moveFocus(event, ROW_KEYS)} className="min-h-0 flex-1 overflow-y-auto">
        {tabs.map((tab) => (
          <OpenTabRow
            key={tab.id}
            tab={tab}
            saved={savedForTab(tab, saved)}
            isActive={tab.id === activeTabId}
            onSelect={onSelect}
            onClose={onClose}
            onOpenMenu={(tabId, position) => setMenu({ tabId, position })}
          />
        ))}
      </ul>
      {menuTab && <ContextMenu position={menu.position} title="" items={tabMenuItems(menuTab, tabs, actions, onClose, besideTabId)} onClose={() => setMenu(null)} />}
    </>
  )
})
