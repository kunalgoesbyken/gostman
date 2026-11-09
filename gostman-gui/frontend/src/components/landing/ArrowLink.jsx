import { ArrowRight } from "lucide-react"
import { cn } from "../../lib/utils"

export function ArrowLink({ href, children, className }) {
  return (
    <a href={href} className={cn("group inline-flex items-center gap-1.5 text-sm font-medium text-primary", className)}>
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  )
}
