import { cn } from "../../lib/utils"
import { APP_TEXT } from "../../lib/appText"

const LINE_WIDTHS = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-2/5", "w-3/5"]

export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("rounded bg-muted motion-safe:animate-pulse", className)} />
}

export function SkeletonLines({ label, lines = 4, className }) {
  return (
    <div role={label ? "status" : undefined} aria-label={label} className={cn("flex flex-col gap-2.5 p-3", className)}>
      {LINE_WIDTHS.slice(0, lines).map((width) => <Skeleton key={width} className={cn("h-3", width)} />)}
    </div>
  )
}

export function EditorSkeleton() {
  return <SkeletonLines label={APP_TEXT.loadingEditor} lines={5} />
}
