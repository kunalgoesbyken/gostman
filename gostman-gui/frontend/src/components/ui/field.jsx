import * as React from "react"
import { cn } from "../../lib/utils"

export const FIELD_COLUMNS = "grid gap-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-3"

export const ACTION_FIELD_COLUMNS = "grid gap-y-4 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:gap-x-3"
export const ACTION_FIELD = "sm:col-span-3 sm:grid-cols-subgrid"
export const ACTION_CONTROL = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 sm:col-span-2 sm:grid-cols-subgrid"

const FIRST_CONTROL_ROW = "sm:leading-7"

const CONTROLS = "button, input, select, textarea, a, [contenteditable], [role]"

export function Field({ label, children, grouped = false, className }) {
  const textRef = React.useRef(null)
  const Root = grouped ? "div" : "label"
  const keepClicksOnLabelOrControl = (event) => {
    if (!event.currentTarget.contains(event.target) || textRef.current?.contains(event.target)) return
    const control = event.target.closest(CONTROLS)
    if (control && event.currentTarget.contains(control)) return
    event.preventDefault()
  }
  return (
    <Root className={cn(FIELD_COLUMNS, "sm:items-start", className)} onClick={grouped ? undefined : keepClicksOnLabelOrControl}>
      <span ref={textRef} className={cn("truncate text-xs text-muted-foreground", FIRST_CONTROL_ROW)} title={label}>{label}</span>
      {children}
    </Root>
  )
}
