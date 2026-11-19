import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Cable, Square } from "lucide-react"
import { IconButton } from "./ui/button"
import { STATUS_ITEM_CLASS } from "./StatusItem"
import { alignInline, inlineStart } from "../hooks/direction"
import { usePopoverDismiss } from "../hooks/usePopoverDismiss"
import { KIND_FLOW, KIND_SOCKET, KIND_STREAM, PHASE_OPEN, statusLabel, useLiveActivities } from "../hooks/useTabActivity"
import { protocolIdOf, PROTOCOL_SSE } from "../lib/requestProtocols"
import { REQUEST_BAR_TEXT } from "../lib/requestBarText"
import { STATUS_BAR_TEXT as TEXT } from "../lib/statusBarText"
import { tabTitle } from "../lib/tabDisplay"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const VIEWPORT_MARGIN = 8
const ANCHOR_GAP = 4
const FOCUS_STEPS = { ArrowDown: 1, ArrowUp: -1 }

const STOPS = {
  [KIND_SOCKET]: (actions, tabId) => actions.sockets.disconnect(tabId),
  [KIND_STREAM]: (actions, tabId) => actions.tabs.cancel(tabId),
  [KIND_FLOW]: (actions, tabId) => actions.flows.stop(tabId),
}

function kindLabel(tab, activity) {
  if (activity.kind === KIND_FLOW) return TEXT.liveFlow
  const protocol = activity.kind === KIND_STREAM ? PROTOCOL_SSE : protocolIdOf(tab.request, true)
  return REQUEST_BAR_TEXT.protocols[protocol]
}

function LiveRow({ tab, activity, actions, onShow }) {
  const name = tabTitle(tab)
  return (
    <div role="presentation" className="flex items-center gap-1 ps-3 pe-1 hover:bg-accent">
      <button type="button" role="menuitem" title={TEXT.liveShow(name)} onClick={() => onShow(tab.id)} className="min-w-0 flex-1 py-1.5 text-start">
        <span dir="auto" className="block truncate text-xs font-medium">{name}</span>
        <span className="block truncate text-2xs text-muted-foreground">{kindLabel(tab, activity)} · {statusLabel(activity)}</span>
      </button>
      <IconButton
        role="menuitem"
        size="icon-xs"
        label={TEXT.liveStop(name)}
        icon={Square}
        className="[&_svg]:fill-current"
        onClick={() => STOPS[activity.kind](actions, tab.id)}
      />
    </div>
  )
}

function LivePopover({ activities, actions, buttonRef, onClose }) {
  const popoverRef = useRef(null)
  const [placement, setPlacement] = useState(null)
  const tabs = useAppStore((state) => state.tabs)
  usePopoverDismiss(popoverRef, buttonRef, onClose)

  useLayoutEffect(() => {
    const anchor = buttonRef.current.getBoundingClientRect()
    const { width } = popoverRef.current.getBoundingClientRect()
    const left = alignInline(inlineStart(anchor), width)
    setPlacement({
      left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)),
      bottom: window.innerHeight - anchor.top + ANCHOR_GAP,
    })
  }, [buttonRef])

  useEffect(() => {
    if (placement && !popoverRef.current.contains(document.activeElement)) popoverRef.current.querySelector("button")?.focus()
  }, [placement, activities.size])

  const show = (tabId) => {
    onClose()
    useAppStore.getState().setActiveTab(tabId)
  }

  const handleKeyDown = (event) => {
    if (event.key === "Tab") {
      onClose()
      buttonRef.current.focus()
      return
    }
    const step = FOCUS_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const buttons = Array.from(popoverRef.current.querySelectorAll("button"))
    buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length].focus()
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="menu"
      aria-label={TEXT.liveLabel}
      data-surface="menu"
      onKeyDown={handleKeyDown}
      style={placement || { left: 0, bottom: 0, visibility: "hidden" }}
      className="fixed z-50 max-h-[min(24rem,calc(100dvh-4rem))] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg"
    >
      {tabs.filter((tab) => activities.has(tab.id)).map((tab) => (
        <LiveRow key={tab.id} tab={tab} activity={activities.get(tab.id)} actions={actions} onShow={show} />
      ))}
    </div>,
    document.body
  )
}

function LiveChip({ activities, actions }) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef(null)
  const close = useCallback(() => setIsOpen(false), [])
  const isSteady = [...activities.values()].every((activity) => activity.phase === PHASE_OPEN)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={TEXT.liveLabel}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(STATUS_ITEM_CLASS, "text-success", isOpen && "bg-accent/60")}
      >
        <Cable aria-hidden="true" className={cn(!isSteady && "motion-safe:animate-pulse")} />
        <span className="max-sm:sr-only">{TEXT.liveCount(activities.size)}</span>
      </button>
      {isOpen && <LivePopover activities={activities} actions={actions} buttonRef={buttonRef} onClose={close} />}
    </>
  )
}

export function LiveTray({ actions }) {
  const activities = useLiveActivities()
  if (activities.size === 0) return null
  return <LiveChip activities={activities} actions={actions} />
}
