import * as React from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { CONTROL_BASE, CONTROL_SIZES } from "./input"
import { SectionLabel } from "./panel"

const VIEWPORT_MARGIN = 8
const LIST_GAP = 4
const MAX_LIST_HEIGHT = 320
const STEPS = { ArrowDown: 1, ArrowUp: -1 }
const CONFIRM_KEYS = ["Enter", " "]

const textOf = (node) => React.Children.toArray(node).join("")

function readEntries(children, group = "") {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return []
    if (child.type === React.Fragment) return readEntries(child.props.children, group)
    if (child.type === "optgroup") return readEntries(child.props.children, child.props.label || "")
    if (child.type !== "option") return []
    const label = textOf(child.props.children)
    return [{ value: String(child.props.value ?? label), label, group, disabled: Boolean(child.props.disabled) }]
  })
}

function placeBelow(anchor) {
  const { left, top, bottom, width } = anchor.getBoundingClientRect()
  const below = window.innerHeight - bottom - VIEWPORT_MARGIN
  const above = top - VIEWPORT_MARGIN
  const opensUp = below < Math.min(MAX_LIST_HEIGHT, 160) && above > below
  const maxHeight = Math.min(MAX_LIST_HEIGHT, opensUp ? above : below) - LIST_GAP
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)),
    minWidth: width,
    maxHeight,
    ...(opensUp ? { bottom: window.innerHeight - top + LIST_GAP } : { top: bottom + LIST_GAP }),
  }
}

function useDismiss(isOpen, close, anchorRef, listRef) {
  React.useEffect(() => {
    if (!isOpen) return undefined
    const closeWhenOutside = (event) => {
      const isInside = anchorRef.current?.contains(event.target) || listRef.current?.contains(event.target)
      if (!isInside) close()
    }
    const closeWhenPageScrolls = (event) => {
      if (!listRef.current?.contains(event.target)) close()
    }
    window.addEventListener("mousedown", closeWhenOutside)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", closeWhenPageScrolls, true)
    return () => {
      window.removeEventListener("mousedown", closeWhenOutside)
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", closeWhenPageScrolls, true)
    }
  }, [isOpen, close, anchorRef, listRef])
}

function OptionRow({ entry, isSelected, isActive, onChoose, onPoint }) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={entry.disabled}
      title={entry.label}
      ref={(element) => {
        if (isActive) element?.scrollIntoView({ block: "nearest" })
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={entry.disabled ? undefined : onChoose}
      onMouseMove={onPoint}
      className={cn(
        "flex h-7 cursor-default items-center gap-2 pl-2 pr-3 text-xs",
        entry.disabled ? "opacity-40" : "text-foreground",
        isActive && !entry.disabled && "bg-accent"
      )}
    >
      <Check className={cn("h-3.5 w-3.5 shrink-0", !isSelected && "invisible")} />
      <span className="truncate">{entry.label}</span>
    </div>
  )
}

const Select = React.forwardRef(function Select(
  { className, children, controlSize = "sm", value, onChange, disabled, title, ...props },
  forwardedRef
) {
  const entries = React.useMemo(() => readEntries(children), [children])
  const [placement, setPlacement] = React.useState(null)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const anchorRef = React.useRef(null)
  const listRef = React.useRef(null)
  const listId = React.useId()

  const isOpen = placement !== null
  const selectedIndex = entries.findIndex((entry) => entry.value === String(value ?? ""))
  const selected = entries[selectedIndex]

  const close = React.useCallback(() => setPlacement(null), [])
  useDismiss(isOpen, close, anchorRef, listRef)

  const open = () => {
    setActiveIndex(selectedIndex)
    setPlacement(placeBelow(anchorRef.current))
  }

  const choose = (entry) => {
    close()
    if (entry.value !== String(value ?? "")) onChange?.({ target: { value: entry.value } })
  }

  const moveActive = (step) => {
    const enabled = entries.map((entry, index) => (entry.disabled ? -1 : index)).filter((index) => index !== -1)
    if (enabled.length === 0) return
    const position = enabled.indexOf(activeIndex)
    setActiveIndex(enabled[(position + step + enabled.length) % enabled.length])
  }

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation()
      close()
      return
    }
    if (STEPS[event.key]) {
      event.preventDefault()
      if (isOpen) moveActive(STEPS[event.key])
      else open()
      return
    }
    if (!CONFIRM_KEYS.includes(event.key)) return
    event.preventDefault()
    if (!isOpen) open()
    else if (entries[activeIndex]) choose(entries[activeIndex])
  }

  const assignRef = (element) => {
    anchorRef.current = element
    if (typeof forwardedRef === "function") forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        role="combobox"
        ref={assignRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        title={title || selected?.label}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        className={cn(CONTROL_BASE, CONTROL_SIZES[controlSize], "flex items-center pr-7 text-left", className)}
        {...props}
      >
        <span className="truncate">{selected ? selected.label : String(value ?? "")}</span>
      </button>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {isOpen && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={placement}
          className="fixed z-50 overflow-y-auto rounded-md border border-border bg-background py-1 shadow-lg"
        >
          {entries.map((entry, index) => (
            <React.Fragment key={`${entry.group}\n${entry.value}`}>
              {entry.group && entry.group !== entries[index - 1]?.group && (
                <SectionLabel className="block truncate px-3 pb-1 pt-2">{entry.group}</SectionLabel>
              )}
              <OptionRow
                entry={entry}
                isSelected={index === selectedIndex}
                isActive={index === activeIndex}
                onChoose={() => choose(entry)}
                onPoint={() => setActiveIndex(index)}
              />
            </React.Fragment>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
})

export { Select }
