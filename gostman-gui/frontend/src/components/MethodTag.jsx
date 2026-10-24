import { resolveTheme, usePreferencesStore } from "../lib/preferences"
import { hasMethodBackground, isStyledMethod, methodBadgeStyle } from "../lib/methodColors"
import { cn } from "../lib/utils"

export function MethodTag({ method, className }) {
  const hasBackground = usePreferencesStore((state) => (
    hasMethodBackground(state.preferences.methodColors, resolveTheme(state.preferences.theme, state.systemIsDark), method)
  ))

  return (
    <span
      style={methodBadgeStyle(method)}
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
