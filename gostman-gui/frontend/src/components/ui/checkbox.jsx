import { cn } from "../../lib/utils"

export function Checkbox({ label, children, className, ...props }) {
  return (
    <label className={cn("flex h-6 min-w-6 shrink-0 items-center justify-center gap-2 text-xs text-muted-foreground", className)}>
      <input type="checkbox" aria-label={children ? undefined : label} className="h-3.5 w-3.5 accent-primary" {...props} />
      {children}
    </label>
  )
}
