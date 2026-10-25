import { RESIZE_CLOSING, RESIZE_IDLE, usePaneResize } from "../../hooks/usePaneResize"
import { DIALOG_TEXT } from "../../lib/dialogText"
import { cn } from "../../lib/utils"

const NOTICE_TONES = {
  muted: "text-muted-foreground",
  warning: "text-warning",
  success: "text-success",
  destructive: "text-destructive",
}

export function Panel({ className, ...props }) {
  return <div className={cn("flex h-full min-h-0 min-w-0 flex-col", className)} {...props} />
}

export function Toolbar({ className, ...props }) {
  return <div className={cn("flex h-10 shrink-0 items-center gap-2 border-b border-border px-3", className)} {...props} />
}

export const STACKED_TOOLBAR = "max-sm:h-auto max-sm:min-h-10 max-sm:flex-wrap max-sm:justify-end max-sm:py-1.5"

export function ToolbarSummary({ label, title, children }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 max-sm:basis-full">
      <SectionLabel>{label}</SectionLabel>
      <span title={title} className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{children}</span>
    </div>
  )
}

export function PanelBody({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [overflow-wrap:anywhere]", className)} {...props} />
}

export function SectionLabel({ className, ...props }) {
  return <span className={cn("shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground", className)} {...props} />
}

export function Notice({ tone = "muted", icon: Icon, edge = "border-b", className, children, ...props }) {
  return (
    <div
      className={cn("flex shrink-0 items-start gap-2 border-border px-3 py-2 text-xs [overflow-wrap:anywhere]", edge, NOTICE_TONES[tone], className)}
      {...props}
    >
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <p className="min-w-0 flex-1">{children}</p>
    </div>
  )
}

export const SPLIT_PANES = "flex min-h-0 flex-1 max-sm:flex-col"

export const PANE_WIDTH = "sm:relative sm:w-[var(--pane-width)]"

export const SPLIT_LIST = `flex shrink-0 flex-col border-border max-sm:max-h-[40%] max-sm:w-full max-sm:border-b sm:border-e ${PANE_WIDTH}`

export const SIDE_PANE = "flex shrink-0 flex-col border-s border-border bg-background max-sm:absolute max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-10 max-sm:z-10 max-sm:w-full max-sm:max-w-none max-sm:border-s-0 max-sm:border-t sm:relative sm:w-[var(--pane-width)]"

const HANDLE_EDGES = { start: "-start-1", end: "-end-1" }

function PaneResizer({ edge, label, phase, separatorProps, className }) {
  return (
    <div
      {...separatorProps}
      aria-label={label}
      data-active={phase !== RESIZE_IDLE || undefined}
      className={cn("group absolute inset-y-0 z-10 flex w-2 cursor-col-resize touch-none justify-center outline-none", HANDLE_EDGES[edge], className)}
    >
      <span className="h-full w-0.5 transition-colors group-hover:bg-ring group-hover:delay-150 group-focus-visible:bg-ring group-data-[active]:bg-ring" />
    </div>
  )
}

export function ResizablePane({ as: Tag = "div", pane, edge, label = DIALOG_TEXT.resizePanel, handleClassName = "max-sm:hidden", onClose, className, style, children, ...props }) {
  const { paneRef, style: widthStyle, phase, separatorProps } = usePaneResize(pane, edge, onClose)
  return (
    <Tag ref={paneRef} data-closing={phase === RESIZE_CLOSING || undefined} style={{ ...style, ...widthStyle }} className={cn("transition-opacity data-[closing]:opacity-50", className)} {...props}>
      {children}
      <PaneResizer edge={edge} label={label} phase={phase} separatorProps={separatorProps} className={handleClassName} />
    </Tag>
  )
}
