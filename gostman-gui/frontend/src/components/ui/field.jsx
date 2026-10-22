import { cn } from "../../lib/utils"

export const FIELD_COLUMNS = "grid gap-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:gap-3"

export function Field({ label, children, grouped = false }) {
  const Root = grouped ? "div" : "label"
  return (
    <Root className={cn(FIELD_COLUMNS, "sm:items-center")}>
      <span className="truncate text-xs text-muted-foreground" title={label}>{label}</span>
      {children}
    </Root>
  )
}
