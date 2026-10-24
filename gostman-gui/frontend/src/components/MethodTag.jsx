import { usePreferencesStore, useResolvedTheme } from "../lib/preferences"
import { hasMethodBackground, isStyledMethod, methodStyle } from "../lib/methodColors"
import { cn } from "../lib/utils"

export function MethodTag({ method, className }) {
  const mode = useResolvedTheme()
  const hasBackground = usePreferencesStore((state) => hasMethodBackground(state.preferences.methodColors, mode, method))

  return (
    <span
      style={methodStyle(method)}
      className={cn(
        "shrink-0 truncate font-mono text-3xs font-semibold",
        !isStyledMethod(method) && "text-muted-foreground",
        hasBackground && "rounded px-0.5 text-center",
        className
      )}
    >
      {method}
    </span>
  )
}
