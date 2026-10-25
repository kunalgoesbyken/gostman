import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { SectionLabel } from "./panel"
import { focusOrigin, returnFocusTo } from "../../lib/panes"
import { isFocusLost } from "../../lib/rovingFocus"
import { cn } from "../../lib/utils"

const VIEWPORT_MARGIN = 8
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 12
const MAX_INDENT_LEVELS = 8

const FOCUS_STEPS = { ArrowDown: 1, ArrowUp: -1 }
const CLOSING_KEYS = ["Escape", "Tab"]

function targetIndex(key, current, count) {
  if (key === "Home") return 0
  if (key === "End") return count - 1
  const step = FOCUS_STEPS[key]
  return step ? (current + step + count) % count : -1
}

const clampToViewport = (start, size, viewportSize) => (
  Math.max(VIEWPORT_MARGIN, Math.min(start, viewportSize - size - VIEWPORT_MARGIN))
)

function MenuItem({ item, onClose }) {
  const Icon = item.icon
  const handleClick = () => {
    item.onSelect()
    if (!item.keepOpen) onClose()
  }
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={item.disabled}
      onClick={handleClick}
      title={item.label}
      style={{ paddingLeft: BASE_PADDING_PX + Math.min(item.indent || 0, MAX_INDENT_LEVELS) * INDENT_STEP_PX }}
      className={cn(
        "flex h-7 w-full items-center gap-2 pr-3 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-40",
        item.destructive && "text-destructive"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
      {item.detail && <span className="ml-auto shrink-0">{item.detail}</span>}
      {item.shortcut && <kbd className="ml-auto">{item.shortcut}</kbd>}
    </button>
  )
}

export function ContextMenu({ position, title, items, onClose }) {
  const menuRef = useRef(null)
  const [placement, setPlacement] = useState(null)
  const [origin] = useState(focusOrigin)

  useEffect(() => () => {
    if (isFocusLost()) returnFocusTo(origin)
  }, [origin])

  useLayoutEffect(() => {
    const { width, height } = menuRef.current.getBoundingClientRect()
    setPlacement({
      left: clampToViewport(position.x, width, window.innerWidth),
      top: clampToViewport(position.y, height, window.innerHeight),
    })
  }, [position, items])

  useEffect(() => {
    if (!placement || menuRef.current.contains(document.activeElement)) return
    menuRef.current.querySelector("button:not(:disabled)")?.focus()
  }, [placement])

  useEffect(() => {
    const closeWhenOutside = (event) => {
      if (!menuRef.current.contains(event.target)) onClose()
    }
    window.addEventListener("mousedown", closeWhenOutside)
    window.addEventListener("resize", onClose)
    return () => {
      window.removeEventListener("mousedown", closeWhenOutside)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  const handleKeyDown = (event) => {
    if (CLOSING_KEYS.includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    const buttons = Array.from(menuRef.current.querySelectorAll("button:not(:disabled)"))
    const next = targetIndex(event.key, buttons.indexOf(document.activeElement), buttons.length)
    if (next < 0) return
    event.preventDefault()
    buttons[next]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-surface="menu"
      onKeyDown={handleKeyDown}
      style={placement || { left: 0, top: 0, visibility: "hidden" }}
      className="fixed z-50 max-h-[calc(100dvh-1rem)] w-56 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg"
    >
      {title && <SectionLabel className="block truncate px-3 py-1" title={title}>{title}</SectionLabel>}
      {items.map((item) => <MenuItem key={item.id} item={item} onClose={onClose} />)}
    </div>,
    document.body
  )
}
