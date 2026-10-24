import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { TAB_KEYS } from "./ui/tabs"
import { MethodTag } from "./MethodTag"
import { usePointerDrag } from "../hooks/usePointerDrag"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { PLACE_AFTER, PLACE_BEFORE } from "../lib/dropPlace"
import { isFocusLost, moveFocus } from "../lib/rovingFocus"
import { hintWithShortcut, isRemoveKey } from "../lib/shortcuts"
import { isRequestDirty } from "../lib/requestChanges"
import { shownMethod } from "../lib/methodLabel"
import { TAB_BAR_TEXT as TEXT } from "../lib/tabBarText"
import { tabMenuItems } from "../lib/tabMenu"
import { cn } from "../lib/utils"

const MIDDLE_MOUSE_BUTTON = 1
const STEP_KEYS = { ArrowLeft: -1, ArrowRight: 1 }
const ACTIVE_TAB = "[role=tab][tabindex=\"0\"]"

const Tab = memo(function Tab({ tab, saved, isActive, dropPlace, isDragged, onSelect, onClose, onCloseFromKeyboard, onPin, onOpenMenu, onPointerDown, onStep }) {
  const tabRef = useRef(null)
  const { request } = tab
  const isDirty = useMemo(() => isRequestDirty(request, saved), [request, saved])
  const title = request.name || request.url || TEXT.untitled

  useEffect(() => {
    if (isActive) tabRef.current.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [isActive])

  const preventAutoscroll = (event) => {
    if (event.button === MIDDLE_MOUSE_BUTTON) event.preventDefault()
  }
  const closeOnMiddleClick = (event) => {
    if (event.button === MIDDLE_MOUSE_BUTTON) onClose(tab.id)
  }
  const openMenuAtPointer = (event) => {
    event.preventDefault()
    onOpenMenu(tab.id, { x: event.clientX, y: event.clientY })
  }
  const handleKeyDown = (event) => {
    if (isRemoveKey(event)) {
      event.preventDefault()
      onCloseFromKeyboard(tab.id)
      return
    }
    const step = event.altKey && event.shiftKey ? STEP_KEYS[event.key] : undefined
    if (!step) return
    event.preventDefault()
    onStep(tab.id, step)
  }

  return (
    <div
      ref={tabRef}
      data-tab-id={tab.id}
      title={request.url ? `${title}\n${request.url}` : title}
      onMouseDown={preventAutoscroll}
      onAuxClick={closeOnMiddleClick}
      onContextMenu={openMenuAtPointer}
      className={cn(
        "group relative flex w-44 shrink-0 select-none items-center border-b-2 border-r border-r-border pr-1.5 text-xs [-webkit-touch-callout:none]",
        isActive ? "border-b-primary text-foreground" : "border-b-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        isDragged && "opacity-50"
      )}
    >
      {dropPlace && <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 w-0.5 bg-primary", dropPlace === PLACE_BEFORE ? "left-0" : "right-0")} />}
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        onClick={() => onSelect(tab.id)}
        onDoubleClick={() => onPin(tab.id)}
        onPointerDown={(event) => onPointerDown(event, tab.id)}
        onKeyDown={handleKeyDown}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left"
      >
        <MethodTag method={shownMethod(request)} />
        <span className={cn("truncate", tab.isPreview && "italic")}>{title}</span>
        {isDirty && <span aria-label={TEXT.unsaved} className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />}
      </button>
      <IconButton label={TEXT.close(title)} icon={X} size="icon-xs" tabIndex={-1} onClick={() => onClose(tab.id)} className="hover:bg-muted" />
    </div>
  )
})

function resolveTabDrop(element, point, source) {
  const tabElement = element.closest("[data-tab-id]")
  if (!tabElement || tabElement.dataset.tabId === source.id) return null
  const { left, width } = tabElement.getBoundingClientRect()
  return { id: tabElement.dataset.tabId, place: (point.x - left) / width < 0.5 ? PLACE_BEFORE : PLACE_AFTER }
}

export const TabBar = memo(function TabBar({ tabs, activeTabId, requests, actions, onTabSelect, onTabClose, onNewTab }) {
  const newRequestShortcut = useShortcutLabel("newRequest")
  const savedById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])
  const [menu, setMenu] = useState(null)
  const listRef = useRef(null)

  const reorder = useCallback((source, drop) => actions.tabs.reorder(source.id, drop.id, drop.place), [actions])
  const { drag, begin } = usePointerDrag({ resolveDrop: resolveTabDrop, onDrop: reorder, scrollRef: listRef, axis: "x" })

  const startDrag = useCallback((event, tabId) => begin(event, { id: tabId }), [begin])
  const refocusAfterClose = useRef(false)
  const closeFromKeyboard = useCallback((tabId) => {
    refocusAfterClose.current = true
    onTabClose(tabId)
  }, [onTabClose])

  useLayoutEffect(() => {
    if (!refocusAfterClose.current) return
    refocusAfterClose.current = false
    if (isFocusLost()) listRef.current?.querySelector(ACTIVE_TAB)?.focus()
  })
  const openMenu = useCallback((tabId, position) => setMenu({ tabId, position }), [])
  const closeMenu = useCallback(() => setMenu(null), [])

  const menuItems = useMemo(() => {
    const tab = menu && tabs.find((candidate) => candidate.id === menu.tabId)
    return tab ? tabMenuItems(tab, tabs, actions, onTabClose) : []
  }, [menu, tabs, actions, onTabClose])

  return (
    <div data-pane="tabs" className="flex h-10 shrink-0 items-stretch border-b border-border">
      <div ref={listRef} role="tablist" aria-label={TEXT.openRequests} onKeyDown={(event) => moveFocus(event, TAB_KEYS)} className="flex min-w-0 items-stretch overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            saved={savedById.get(tab.request.id)}
            isActive={tab.id === activeTabId}
            dropPlace={drag?.drop?.id === tab.id ? drag.drop.place : null}
            isDragged={drag?.source.id === tab.id}
            onSelect={onTabSelect}
            onClose={onTabClose}
            onCloseFromKeyboard={closeFromKeyboard}
            onPin={actions.tabs.pin}
            onOpenMenu={openMenu}
            onPointerDown={startDrag}
            onStep={actions.tabs.step}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center px-1.5">
        <IconButton label={hintWithShortcut(TEXT.newRequest, newRequestShortcut)} icon={Plus} onClick={onNewTab} />
      </div>
      {menu && <ContextMenu position={menu.position} title="" items={menuItems} onClose={closeMenu} />}
    </div>
  )
})
