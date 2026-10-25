import { createContext, useContext, useEffect, useId, useRef } from "react"
import { GripVertical, X } from "lucide-react"
import { IconButton } from "./button"
import { RESIZE_EDGES, useFloatingWindow } from "../../hooks/useFloatingWindow"
import { useFocusTrap } from "../../hooks/useFocusTrap"
import { DIALOG_TEXT } from "../../lib/dialogText"
import { APP_TEXT } from "../../lib/appText"
import { cn } from "../../lib/utils"

const DIALOG_OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 max-sm:p-2"
const FLOATING_LAYER = "fixed inset-0 z-50"
const FLOATING_PANEL = "fixed max-h-none max-w-none shadow-2xl ring-1 ring-foreground/10"

const DIALOG_SIZES = {
  sm: "max-w-md",
  lg: "h-[36rem] max-w-3xl max-sm:h-full",
}

const EDGE_HANDLES = {
  n: "-top-1 inset-x-3 h-2 cursor-ns-resize",
  s: "-bottom-1 inset-x-3 h-2 cursor-ns-resize",
  e: "-right-1 inset-y-3 w-2 cursor-ew-resize",
  w: "-left-1 inset-y-3 w-2 cursor-ew-resize",
  ne: "-right-1 -top-1 h-4 w-4 cursor-nesw-resize",
  sw: "-bottom-1 -left-1 h-4 w-4 cursor-nesw-resize",
  nw: "-left-1 -top-1 h-4 w-4 cursor-nwse-resize",
  se: "-bottom-1 -right-1 h-4 w-4 cursor-nwse-resize",
}

const FloatingContext = createContext(null)

const openDialogs = []

const isTopmost = (ref) => openDialogs[openDialogs.length - 1] === ref

const keepFocusInDialog = (event) => event.preventDefault()

const CODE_EDITOR = ".cm-editor"

const isHandledElsewhere = (event) => event.defaultPrevented || Boolean(event.target.closest?.(CODE_EDITOR))

function ResizeHandles({ frame }) {
  return (
    <div aria-hidden="true" style={frame.style} className="pointer-events-none fixed select-none">
      {RESIZE_EDGES.map((edge) => (
        <div key={edge} className={cn("pointer-events-auto absolute touch-none", EDGE_HANDLES[edge])} {...frame.edgeProps(edge)} />
      ))}
    </div>
  )
}

export function Dialog({ label, size = "sm", floating, onClose, className, children }) {
  const dialogRef = useRef(null)
  const frame = useFloatingWindow(floating)
  useFocusTrap(dialogRef)

  useEffect(() => {
    openDialogs.push(dialogRef)
    return () => openDialogs.splice(openDialogs.indexOf(dialogRef), 1)
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && isTopmost(dialogRef) && !isHandledElsewhere(event)) onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className={frame ? FLOATING_LAYER : DIALOG_OVERLAY} onMouseDown={frame ? keepFocusInDialog : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-surface="dialog"
        style={frame?.style}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg focus:outline-none",
          DIALOG_SIZES[size],
          className,
          frame && FLOATING_PANEL
        )}
      >
        <FloatingContext.Provider value={frame}>{children}</FloatingContext.Provider>
      </div>
      {frame && <ResizeHandles frame={frame} />}
    </div>
  )
}

export function DialogPending() {
  return <div role="status" aria-label={APP_TEXT.loading} className={DIALOG_OVERLAY} />
}

function WindowGrip({ frame }) {
  const hintId = useId()

  return (
    <>
      <button
        type="button"
        aria-label={DIALOG_TEXT.moveWindow}
        aria-describedby={hintId}
        title={DIALOG_TEXT.moveHint}
        className="-ms-2 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...frame.gripProps}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span id={hintId} className="sr-only">{DIALOG_TEXT.moveHint}</span>
    </>
  )
}

export function DialogHeader({ onClose, children }) {
  const frame = useContext(FloatingContext)

  return (
    <div className={cn("flex h-10 shrink-0 items-center gap-2 border-b border-border ps-4 pe-2 max-sm:h-auto max-sm:min-h-10 max-sm:py-1", frame && "touch-none select-none")} {...frame?.headerProps}>
      {frame && <WindowGrip frame={frame} />}
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 max-sm:h-auto max-sm:flex-wrap">{children}</div>
      {onClose && <IconButton label={DIALOG_TEXT.close} icon={X} onClick={onClose} />}
    </div>
  )
}

export function DialogTitle({ children }) {
  return <h2 className="truncate text-sm font-semibold max-sm:basis-full" title={children}>{children}</h2>
}

export function DialogBody({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [overflow-wrap:anywhere]", className)} {...props} />
}

export function DialogFooter({ children }) {
  return <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{children}</div>
}
