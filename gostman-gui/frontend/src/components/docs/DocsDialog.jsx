import { useEffect, useRef } from "react"

export function DocsDialog({ open, onClose, label, className, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const closeOnBackdrop = (event) => {
    if (event.target === ref.current) onClose()
  }

  return (
    <dialog ref={ref} aria-label={label} onClose={onClose} onClick={closeOnBackdrop} className={className}>
      {open ? children : null}
    </dialog>
  )
}
