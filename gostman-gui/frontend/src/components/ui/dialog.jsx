import { createContext, Suspense, useContext, useEffect, useId, useRef, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { GripVertical, Minus, X } from "lucide-react"
import { IconButton } from "./button"
import { Skeleton, SkeletonLines } from "./skeleton"
import { RESIZE_EDGES, useFloatingWindow } from "../../hooks/useFloatingWindow"
import { useFocusTrap } from "../../hooks/useFocusTrap"
import { DIALOG_TEXT } from "../../lib/dialogText"
import { APP_TEXT } from "../../lib/appText"
import { cn } from "../../lib/utils"
import { dropWindow, hasModal, holdModal, isTopModal, minimizedWindows, minimizeWindow, openWindows, raiseWindow, subscribeToWindows, windowLayer, windowProps } from "../../lib/windowLayers"

const DIALOG_OVERLAY = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 max-sm:p-2"
const FLOATING_LAYER = "fixed inset-0 z-50"
const FLOATING_PANEL = "fixed max-h-none max-w-none shadow-2xl ring-1 ring-foreground/10"
const MODELESS_LAYER = "pointer-events-none fixed inset-0"
const MODELESS_PANEL = "pointer-events-auto"
const DIALOG_PANEL = "flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg focus:outline-none"

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

const WindowContext = createContext(false)

const ToolWindowContext = createContext(null)

const keepFocusInDialog = (event) => event.preventDefault()

const stopMouseDown = (event) => event.stopPropagation()

const CODE_EDITOR = ".cm-editor"

const isInEditor = (event) => Boolean(event.target.closest?.(CODE_EDITOR))

function useOpenDialog(ref, isModal = true) {
  useEffect(() => (isModal ? holdModal(ref) : undefined), [ref, isModal])
}

function useWindowLayer(id, isToolWindow, isModeless) {
  const order = useSyncExternalStore(subscribeToWindows, openWindows, openWindows)
  const minimized = useSyncExternalStore(subscribeToWindows, minimizedWindows, minimizedWindows)
  useEffect(() => {
    if (!isToolWindow) return undefined
    if (isModeless) raiseWindow(id)
    return () => dropWindow(id)
  }, [id, isToolWindow, isModeless])
  return { layer: windowLayer(order, id), isMinimized: isToolWindow && minimized.includes(id) }
}

function useFocusOnRestore(ref, isMinimized) {
  const wasMinimized = useRef(isMinimized)
  useEffect(() => {
    if (wasMinimized.current && !isMinimized && !ref.current.contains(document.activeElement)) ref.current.focus()
    wasMinimized.current = isMinimized
  }, [ref, isMinimized])
}

function closesOnEscape(event, dialog, isModeless) {
  if (event.key !== "Escape" || event.defaultPrevented) return false
  return isModeless ? dialog.current.contains(event.target) && !hasModal() : isTopModal(dialog)
}

export function ResizeHandles({ frame }) {
  return (
    <div aria-hidden="true" style={frame.style} className="pointer-events-none fixed select-none">
      {RESIZE_EDGES.map((edge) => (
        <div key={edge} className={cn("pointer-events-auto absolute touch-none", EDGE_HANDLES[edge])} {...frame.edgeProps(edge)} />
      ))}
    </div>
  )
}

export function Dialog({ label, size = "sm", floating, closesFromEditor = false, onClose, className, children }) {
  const dialogRef = useRef(null)
  const frame = useFloatingWindow(floating)
  const isToolWindow = Boolean(floating?.modeless)
  const isModeless = Boolean(frame && isToolWindow)
  const { layer, isMinimized } = useWindowLayer(floating?.id, isToolWindow, isModeless)
  const isInsideWindow = useContext(WindowContext)
  const isBlocking = !isModeless && !isMinimized
  useFocusTrap(dialogRef, isBlocking)
  useOpenDialog(dialogRef, isBlocking)
  useFocusOnRestore(dialogRef, isMinimized)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (!closesOnEscape(event, dialogRef, isModeless)) return
      if (isInEditor(event) && !closesFromEditor) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, closesFromEditor, isModeless])

  const panel = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal={!isModeless}
      aria-label={label}
      data-surface="dialog"
      style={frame?.style}
      {...(isToolWindow && windowProps(floating.id))}
      {...(!isModeless && { onMouseDown: stopMouseDown })}
      className={cn(DIALOG_PANEL, DIALOG_SIZES[size], className, frame && FLOATING_PANEL, isModeless && MODELESS_PANEL)}
    >
      <FloatingContext.Provider value={frame}>
        <ToolWindowContext.Provider value={isToolWindow ? floating.id : null}>{children}</ToolWindowContext.Provider>
      </FloatingContext.Provider>
    </div>
  )

  if (isModeless) {
    return (
      <WindowContext.Provider value>
        <div className={cn(MODELESS_LAYER, isMinimized && "hidden")} style={{ zIndex: layer }} onPointerDownCapture={() => raiseWindow(floating.id)}>
          {panel}
          <ResizeHandles frame={frame} />
        </div>
      </WindowContext.Provider>
    )
  }

  const modal = (
    <div className={cn(frame ? FLOATING_LAYER : DIALOG_OVERLAY, isMinimized && "hidden")} onMouseDown={frame ? keepFocusInDialog : onClose}>
      {panel}
      {frame && <ResizeHandles frame={frame} />}
    </div>
  )
  return isInsideWindow ? createPortal(<WindowContext.Provider value={false}>{modal}</WindowContext.Provider>, document.body) : modal
}

export function DialogPending() {
  const overlayRef = useRef(null)
  useOpenDialog(overlayRef)
  return (
    <div ref={overlayRef} className={DIALOG_OVERLAY}>
      <div role="status" aria-label={APP_TEXT.loading} className={cn("flex w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg", DIALOG_SIZES.lg)}>
        <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
          <Skeleton className="h-3 w-32" />
        </div>
        <SkeletonLines lines={6} className="p-4" />
      </div>
    </div>
  )
}

export function DialogSuspense({ children }) {
  return <Suspense fallback={<DialogPending />}>{children}</Suspense>
}

export function WindowGrip({ frame }) {
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
  const toolWindow = useContext(ToolWindowContext)

  return (
    <div className={cn("flex h-10 shrink-0 items-center gap-2 border-b border-border ps-4 pe-2 max-sm:h-auto max-sm:min-h-10 max-sm:items-start max-sm:py-1.5 max-sm:[&_h2]:leading-7", frame && "touch-none select-none")} {...frame?.headerProps}>
      {frame && <WindowGrip frame={frame} />}
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 max-sm:h-auto max-sm:flex-wrap">{children}</div>
      {toolWindow && <IconButton label={DIALOG_TEXT.minimize} title={DIALOG_TEXT.minimizeHint} icon={Minus} onClick={() => minimizeWindow(toolWindow)} />}
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
