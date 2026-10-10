import { memo } from "react"
import { cn } from "../../lib/utils"

export const EmptyState = memo(({ icon: Icon, title, description, className, action }) => (
  <div
    className={cn(
      "flex min-h-full flex-col items-center justify-center gap-0 p-6 text-center",
      className
    )}
  >
    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
    <p className="mt-4 text-sm font-medium text-foreground/90">{title}</p>
    {description && (
      <p className="mt-1 max-w-[28ch] text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
))

EmptyState.displayName = "EmptyState"
