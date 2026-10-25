import { cn } from "../../lib/utils"

export function Switch({ checked, label, onCheckedChange, children, className, ...props }) {
  return (
    <span className={cn("flex shrink-0 items-center gap-2 text-xs text-muted-foreground", className)}>
      <button
        {...props}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors focus-visible:outline-offset-2 disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted-foreground/40",
        )}
      >
        <span aria-hidden="true" className={cn("h-3 w-3 rounded-full bg-background transition-transform", checked ? "translate-x-3.5 rtl:-translate-x-3.5" : "translate-x-0.5 rtl:-translate-x-0.5")} />
      </button>
      {children && <span aria-hidden="true" className="whitespace-nowrap">{children}</span>}
    </span>
  )
}
