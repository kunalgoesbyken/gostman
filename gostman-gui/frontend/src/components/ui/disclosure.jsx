import { ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"

const SUMMARY_CLASS = "flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden"

export function DisclosureSummary({ className, children }) {
  return (
    <summary className={cn(SUMMARY_CLASS, className)}>
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      {children}
    </summary>
  )
}
