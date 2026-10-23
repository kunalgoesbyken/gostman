import { useEffect, useState } from "react"
import { focusableWithin } from "../lib/focusable"
import { focusOrigin, returnFocusTo } from "../lib/panes"

function wrapTab(event, container) {
  const items = focusableWithin(container)
  if (items.length === 0) return event.preventDefault()
  const active = document.activeElement
  const atStart = active === items[0] || active === container
  const atEnd = active === items[items.length - 1]
  if (!(event.shiftKey ? atStart : atEnd)) return
  event.preventDefault()
  const target = event.shiftKey ? items[items.length - 1] : items[0]
  target.focus()
}

export function useFocusTrap(ref) {
  const [origin] = useState(focusOrigin)

  useEffect(() => {
    const container = ref.current
    if (!container.contains(document.activeElement)) container.focus()
    const trap = (event) => {
      if (event.key === "Tab") wrapTab(event, container)
    }
    container.addEventListener("keydown", trap)
    return () => {
      container.removeEventListener("keydown", trap)
      returnFocusTo(origin)
    }
  }, [ref, origin])
}
