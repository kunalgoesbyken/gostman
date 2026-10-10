import { METHOD_COLORS } from "../lib/constants"
import { lookup } from "../lib/dataUtils"
import { cn } from "../lib/utils"

export function MethodTag({ method, className }) {
  return (
    <span className={cn("shrink-0 truncate font-mono text-[10px] font-semibold", lookup(METHOD_COLORS, method) || "text-muted-foreground", className)}>
      {method}
    </span>
  )
}
