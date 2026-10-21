import { useEffect, useState } from "react"
import { chordFromEvent, eventModifiers } from "../lib/chords"

const NO_MODIFIERS = {}

const hasModifier = (event) => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey

export function useChordCapture(isActive, isApple, { onResult, onCancel }) {
  const [modifiers, setModifiers] = useState(NO_MODIFIERS)

  useEffect(() => {
    if (!isActive) return undefined

    const handleKeyDown = (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === "Escape" && !hasModifier(event)) {
        onCancel()
        return
      }
      const result = chordFromEvent(event, isApple)
      if (result.modifiers) setModifiers(result.modifiers)
      else onResult(result)
    }

    const handleKeyUp = (event) => setModifiers(eventModifiers(event, isApple))

    window.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("keyup", handleKeyUp, true)
    window.addEventListener("blur", onCancel)
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      window.removeEventListener("keyup", handleKeyUp, true)
      window.removeEventListener("blur", onCancel)
      setModifiers(NO_MODIFIERS)
    }
  }, [isActive, isApple, onResult, onCancel])

  return modifiers
}
