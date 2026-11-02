import { ArrowLeft, ArrowRight, Columns2, Copy, FolderSearch, Pin, X } from "lucide-react"
import { TAB_TEXT } from "./treeText"
import { isRtl } from "../hooks/direction"
import { isDocumentTab } from "../store/appStore"

export function tabMenuItems(tab, tabs, actions, closeTab, besideTabId) {
  const index = tabs.findIndex((candidate) => candidate.id === tab.id)
  const others = tabs.length > 1
  const toLeft = isRtl() ? 1 : -1
  const isLast = index === tabs.length - 1
  const canMoveLeft = isRtl() ? !isLast : index > 0
  const canMoveRight = isRtl() ? index > 0 : !isLast
  return [
    { id: "close", label: TAB_TEXT.close, icon: X, onSelect: () => closeTab(tab.id) },
    { id: "close-others", label: TAB_TEXT.closeOthers, icon: X, disabled: !others, onSelect: () => actions.tabs.closeOthers(tab.id) },
    { id: "close-right", label: TAB_TEXT.closeRight, icon: X, disabled: index === tabs.length - 1, onSelect: () => actions.tabs.closeRight(tab.id) },
    { id: "close-saved", label: TAB_TEXT.closeSaved, icon: X, onSelect: () => actions.tabs.closeSaved() },
    ...(tab.isPreview ? [{ id: "keep", label: TAB_TEXT.keepOpen, icon: Pin, onSelect: () => actions.tabs.pin(tab.id) }] : []),
    { id: "move-left", label: TAB_TEXT.moveLeft, icon: ArrowLeft, disabled: !canMoveLeft, onSelect: () => actions.tabs.step(tab.id, toLeft) },
    { id: "move-right", label: TAB_TEXT.moveRight, icon: ArrowRight, disabled: !canMoveRight, onSelect: () => actions.tabs.step(tab.id, -toLeft) },
    { id: "reveal", label: TAB_TEXT.revealInTree, icon: FolderSearch, disabled: !actions.tabs.canReveal(tab), onSelect: () => actions.tabs.reveal(tab.id) },
    ...(isDocumentTab(tab) ? [] : [{ id: "beside", label: tab.id === besideTabId ? TAB_TEXT.hideBeside : TAB_TEXT.showBeside, icon: Columns2, onSelect: () => actions.tabs.toggleBeside(tab.id) }]),
    ...(isDocumentTab(tab) ? [] : [{ id: "curl", label: TAB_TEXT.copyAsCurl, icon: Copy, onSelect: () => actions.tabs.copyCurl(tab.id) }]),
  ]
}
