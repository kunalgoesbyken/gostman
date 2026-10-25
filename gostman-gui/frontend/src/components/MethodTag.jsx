import { usePreferencesStore, useResolvedTheme } from "../lib/preferences"
import { hasMethodBackground, hasMethodTone, methodStyle } from "../lib/methodColors"
import { compactMethod } from "../lib/methodLabel"
import { cn } from "../lib/utils"

export function MethodTag({ method, compact = false, className }) {
  const mode = useResolvedTheme()
  const hasBackground = usePreferencesStore((state) => hasMethodBackground(state.preferences.methodColors, mode, method))
  const shown = compact ? compactMethod(method) : method

  return (
    <span
      title={shown === method ? undefined : method}
      style={methodStyle(method)}
      className={cn(
        "shrink-0 truncate font-mono text-3xs font-semibold",
        !hasMethodTone(method) && "text-muted-foreground",
        hasBackground && "rounded px-0.5 text-center",
        className
      )}
    >
      {shown}
    </span>
  )
}
