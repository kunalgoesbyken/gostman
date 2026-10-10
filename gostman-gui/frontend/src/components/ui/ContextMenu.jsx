import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "../../lib/utils"

const VIEWPORT_MARGIN = 8
const INDENT_STEP_PX = 12
const BASE_PADDING_PX = 10
const MAX_INDENT_LEVELS = 8

const FOCUS_STEPS = { ArrowDown: 1, ArrowUp: -1 }

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
      disabled={item.disabled}
      onClick={handleClick}
      style={{ paddingLeft: BASE_PADDING_PX + Math.min(item.indent || 0, MAX_INDENT_LEVELS) * INDENT_STEP_PX }}
      className={cn(
        "flex w-full items-center gap-2 py-1.5 pr-3 text-left text-xs outline-none",
        "hover:bg-accent/60 focus-visible:bg-accent/60 disabled:pointer-events-none disabled:opacity-40",
        item.destructive && "text-destructive"
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
    </button>
  )
}

export function ContextMenu({ position, title, items, onClose }) {
  const menuRef = useRef(null)
  const [placement, setPlacement] = useState(null)

  useLayoutEffect(() => {
    const { width, height } = menuRef.current.getBoundingClientRect()
    setPlacement({
      left: clampToViewport(position.x, width, window.innerWidth),
      top: clampToViewport(position.y, height, window.innerHeight),
    })
    menuRef.current.querySelector("button:not(:disabled)")?.focus()
  }, [position, items])

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
    if (event.key === "Escape") {
      onClose()
      return
    }
    const step = FOCUS_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const buttons = Array.from(menuRef.current.querySelectorAll("button:not(:disabled)"))
    const current = buttons.indexOf(document.activeElement)
    buttons[(current + step + buttons.length) % buttons.length]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      onKeyDown={handleKeyDown}
      style={placement || { left: 0, top: 0, visibility: "hidden" }}
      className="fixed z-50 max-h-72 w-52 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-md scrollbar-compact"
    >
      {title && (
        <div className="truncate px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      {items.map((item) => <MenuItem key={item.id} item={item} onClose={onClose} />)}
    </div>,
    document.body
  )
}
