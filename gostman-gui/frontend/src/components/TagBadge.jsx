import { usePreferencesStore } from "../lib/preferences"
import { colorTriplet } from "../lib/swatches"
import { tagColor } from "../lib/tagColors"
import { cn } from "../lib/utils"

const tintStyle = (tint) => ({ backgroundColor: `hsl(${tint} / 0.16)`, borderColor: `hsl(${tint} / 0.55)` })

export function TagBadge({ tag, className, children }) {
  const tint = usePreferencesStore((state) => colorTriplet(tagColor(state.preferences.tagColors, tag)))

  return (
    <span style={tintStyle(tint)} className={cn("inline-flex min-w-0 max-w-full items-center rounded border text-foreground", className)}>
      <span className="truncate">{tag}</span>
      {children}
    </span>
  )
}
