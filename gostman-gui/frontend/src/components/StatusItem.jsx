import { cn } from "../lib/utils"

export const STATUS_ITEM_CLASS = "inline-flex h-full items-center gap-1.5 px-2 transition-colors hover:bg-accent hover:text-foreground max-sm:px-3 [&_svg]:size-3 max-sm:[&_svg]:size-4"

export function StatusItem({ icon: Icon, label, active, className, ...props }) {
  return (
    <button type="button" className={cn(STATUS_ITEM_CLASS, active && "text-success", className)} {...props}>
      <Icon aria-hidden="true" />
      <span className="max-sm:sr-only">{label}</span>
    </button>
  )
}
