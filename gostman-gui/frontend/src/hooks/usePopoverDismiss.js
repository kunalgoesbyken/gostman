import { useEffect } from "react"

export function usePopoverDismiss(popoverRef, buttonRef, onClose) {
  useEffect(() => {
    const closeWhenOutside = (event) => {
      if (popoverRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return
      onClose()
    }
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return
      onClose()
      buttonRef.current?.focus()
    }
    window.addEventListener("mousedown", closeWhenOutside)
    window.addEventListener("keydown", closeOnEscape)
    window.addEventListener("resize", onClose)
    return () => {
      window.removeEventListener("mousedown", closeWhenOutside)
      window.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", onClose)
    }
  }, [popoverRef, buttonRef, onClose])
}
