import { useEffect } from "react"
import { isApplePlatform, isDesktopApp } from "../lib/platform"
import { usePreferences } from "../lib/preferences"
import { activeShortcuts, matchesBinding, shortcutLabelFor } from "../lib/shortcuts"

export function useShortcutLabel(id) {
  return shortcutLabelFor(id, usePreferences().shortcuts)
}

export function useShortcuts(handlers, isEnabled) {
  const { shortcuts } = usePreferences()

  useEffect(() => {
    if (!isEnabled) return undefined

    const bindings = activeShortcuts(isDesktopApp(), shortcuts)
    const isApple = isApplePlatform()

    const handleKeyDown = (event) => {
      const match = bindings.find(({ binding }) => matchesBinding(binding, event, isApple))
      const run = match && handlers[match.shortcut.id]
      if (!run) return
      event.preventDefault()
      run(match.shortcut.position)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlers, isEnabled, shortcuts])
}
