import { useEffect } from "react"
import { activeShortcuts, matchesBinding } from "../lib/shortcuts"

// handlers maps a shortcut id from lib/shortcuts to the function it runs.
export function useShortcuts(handlers, isEnabled) {
  useEffect(() => {
    if (!isEnabled) return undefined

    const bindings = activeShortcuts().map(({ shortcut, binding }) => ({ shortcut, binding }))

    const handleKeyDown = (event) => {
      const match = bindings.find(({ binding }) => matchesBinding(binding, event))
      const run = match && handlers[match.shortcut.id]
      if (!run) return
      event.preventDefault()
      run(match.shortcut.position)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handlers, isEnabled])
}
