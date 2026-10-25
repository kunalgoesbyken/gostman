import { memo, useState } from "react"
import { Copy, MoreHorizontal, Pencil, Plus, Sparkles, Trash2, Workflow } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { ContextMenu } from "../ui/ContextMenu"
import { EmptyState } from "../ui/emptyState"
import { Toolbar } from "../ui/panel"
import { FLOW_TEXT } from "../../lib/flowsText"
import { allStepIds } from "../../lib/flows/model"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { isRemoveKey } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"
import { selectActiveTab, useAppStore } from "../../store/appStore"

const ROW_KEYS = { selector: "[data-flow-row]", orientation: ORIENTATION.vertical }

function FlowRow({ flow, isActive, actions, onMenu }) {
  const openMenu = (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    onMenu(flow.id, { x: event.clientX || rect.left, y: event.clientY || rect.bottom })
  }
  const handleKeyDown = (event) => {
    if (!isRemoveKey(event)) return
    event.preventDefault()
    actions.remove(flow.id)
  }
  return (
    <li className="group relative flex items-center" onContextMenu={openMenu}>
      <button
        type="button"
        data-flow-row={flow.id}
        aria-current={isActive || undefined}
        onClick={() => actions.open(flow.id)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 pl-3 pr-9 text-left text-xs hover:bg-accent",
          isActive ? "bg-accent text-foreground" : "text-muted-foreground"
        )}
      >
        <Workflow aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-foreground">{flow.name}</span>
        <span className="shrink-0 text-2xs group-focus-within:hidden group-hover:hidden">{FLOW_TEXT.steps(allStepIds(flow.steps).length)}</span>
      </button>
      <IconButton
        label={FLOW_TEXT.actions(flow.name)}
        icon={MoreHorizontal}
        size="icon-xs"
        onClick={openMenu}
        className="absolute right-1.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      />
    </li>
  )
}

const menuItems = (flowId, actions) => [
  { id: "rename", label: FLOW_TEXT.rename, icon: Pencil, onSelect: () => actions.rename(flowId) },
  { id: "duplicate", label: FLOW_TEXT.duplicate, icon: Copy, onSelect: () => actions.duplicate(flowId) },
  { id: "delete", label: FLOW_TEXT.remove, icon: Trash2, destructive: true, onSelect: () => actions.remove(flowId) },
]

export const FlowList = memo(function FlowList({ actions }) {
  const flows = useAppStore((s) => s.flows)
  const activeFlowId = useAppStore((s) => selectActiveTab(s).flowId)
  const [menu, setMenu] = useState(null)

  if (flows.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title={FLOW_TEXT.emptyTitle}
        description={FLOW_TEXT.emptyDescription}
        action={(
          <div className="flex flex-col items-center gap-1.5">
            <Button size="sm" onClick={() => actions.create(false)}>
              <Plus />
              {FLOW_TEXT.newFlow}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => actions.create(true)}>
              <Sparkles />
              {FLOW_TEXT.example}
            </Button>
          </div>
        )}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Toolbar className="justify-between pr-1.5">
        <span className="text-xs text-muted-foreground">{FLOW_TEXT.count(flows.length)}</span>
        <div className="flex items-center">
          <IconButton label={FLOW_TEXT.example} icon={Sparkles} onClick={() => actions.create(true)} />
          <IconButton label={FLOW_TEXT.newFlow} icon={Plus} onClick={() => actions.create(false)} />
        </div>
      </Toolbar>
      <ul aria-label={FLOW_TEXT.listLabel} onKeyDown={(event) => moveFocus(event, ROW_KEYS)} className="min-h-0 flex-1 overflow-y-auto py-1">
        {flows.map((flow) => (
          <FlowRow key={flow.id} flow={flow} isActive={flow.id === activeFlowId} actions={actions} onMenu={(flowId, position) => setMenu({ flowId, position })} />
        ))}
      </ul>
      {menu && <ContextMenu position={menu.position} title="" items={menuItems(menu.flowId, actions)} onClose={() => setMenu(null)} />}
    </div>
  )
})
