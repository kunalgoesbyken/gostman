import { ArrowUpRight, BarChart3, Copy, MoreHorizontal, Trash2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { HISTORY_TEXT } from "../lib/sidebarText"
import { TAB_TEXT } from "../lib/treeText"

export function menuOpener(target, onOpenMenu) {
  return (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    onOpenMenu(target, { x: event.clientX || rect.left, y: event.clientY || rect.bottom })
  }
}

export function RowMenuButton({ name, isOpen, onOpen, onClose }) {
  return (
    <IconButton
      label={HISTORY_TEXT.actions(name)}
      icon={MoreHorizontal}
      size="icon-xs"
      tabIndex={-1}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onClick={isOpen ? onClose : onOpen}
      className="shrink-0 opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
    />
  )
}

export function rowMenuItems(target, actions, remove) {
  const { entry } = target
  return [
    { id: "open", label: HISTORY_TEXT.open, icon: ArrowUpRight, onSelect: () => actions.openHistoryEntry(entry) },
    { id: "calls", label: HISTORY_TEXT.showCalls, icon: BarChart3, onSelect: () => actions.openHistoryCalls(entry) },
    ...(actions.tabs.canCopyCurl(entry) ? [{ id: "curl", label: TAB_TEXT.copyAsCurl, icon: Copy, onSelect: () => actions.tabs.copyRequestCurl(entry) }] : []),
    { id: "delete", label: HISTORY_TEXT.delete, icon: Trash2, destructive: true, separated: true, onSelect: () => remove(target) },
  ]
}
