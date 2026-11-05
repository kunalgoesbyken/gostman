import * as React from "react"
import { cn } from "../../lib/utils"

export const FIELD_COLUMNS = "grid gap-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-3"

const CONTROLS = "button, input, select, textarea, a, [contenteditable], [role]"

export function Field({ label, children, grouped = false }) {
  const textRef = React.useRef(null)
  const Root = grouped ? "div" : "label"
  const keepClicksOnLabelOrControl = (event) => {
    if (!event.currentTarget.contains(event.target) || textRef.current?.contains(event.target)) return
    const control = event.target.closest(CONTROLS)
    if (control && event.currentTarget.contains(control)) return
    event.preventDefault()
  }
  return (
    <Root className={cn(FIELD_COLUMNS, "sm:items-center")} onClick={grouped ? undefined : keepClicksOnLabelOrControl}>
      <span ref={textRef} className="truncate text-xs text-muted-foreground" title={label}>{label}</span>
      {children}
    </Root>
  )
}
