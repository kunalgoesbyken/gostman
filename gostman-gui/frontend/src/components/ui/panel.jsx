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

export function PanelBody({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [overflow-wrap:anywhere]", className)} {...props} />
}

export function SectionLabel({ className, ...props }) {
  return <span className={cn("shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)} {...props} />
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
