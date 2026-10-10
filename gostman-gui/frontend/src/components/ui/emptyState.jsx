import { cn } from "../../lib/utils"

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex min-h-full flex-col items-center justify-center gap-1 p-4 text-center [overflow-wrap:anywhere]", className)}>
      <Icon className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <p className="text-xs font-medium text-foreground">{title}</p>
      {description && <p className="max-w-[40ch] text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
