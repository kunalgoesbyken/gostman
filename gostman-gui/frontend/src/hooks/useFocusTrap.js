import { useEffect } from "react"

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const focusableWithin = (container) => [...container.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null)

function wrapTab(event, container) {
  const items = focusableWithin(container)
  if (items.length === 0) return event.preventDefault()
  const edge = event.shiftKey ? items[0] : items[items.length - 1]
  if (document.activeElement !== edge) return
  event.preventDefault()
  const target = event.shiftKey ? items[items.length - 1] : items[0]
  target.focus()
}

export function useFocusTrap(ref) {
  useEffect(() => {
    const container = ref.current
    const previous = document.activeElement
    if (!container.contains(document.activeElement)) (focusableWithin(container)[0] || container).focus()
    const trap = (event) => {
      if (event.key === "Tab") wrapTab(event, container)
    }
    container.addEventListener("keydown", trap)
    return () => {
      container.removeEventListener("keydown", trap)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [ref])
}
