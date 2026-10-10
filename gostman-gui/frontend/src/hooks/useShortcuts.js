import { useEffect } from "react"

export function useShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      const run = shortcuts.get(event.key.toLowerCase())
      if (!run) return
      event.preventDefault()
      run()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}
