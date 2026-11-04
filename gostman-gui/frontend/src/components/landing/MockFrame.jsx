import { useRef } from "react"
import { useSeenOnce } from "../../hooks/useSeenOnce"
import { cn } from "../../lib/utils"

export const lineStyle = (index) => ({ "--line": index })

export function MockFrame({ title, header, action, label, isPlaying = true, className, children }) {
  const figureRef = useRef(null)
  const isSeen = useSeenOnce(figureRef)
  return (
    <figure
      ref={figureRef}
      aria-label={label}
      className={cn("flex flex-col overflow-hidden rounded-lg border border-border/60 bg-background", isSeen ? isPlaying && "mock-play" : "mock-wait", className)}
    >
      {(header || title) && (
        <figcaption className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border/60 pl-4 pr-1.5 font-mono text-xs text-muted-foreground sm:h-10">
          {header ?? <span className="truncate">{title}</span>}
          {action}
        </figcaption>
      )}
      {children}
    </figure>
  )
}
