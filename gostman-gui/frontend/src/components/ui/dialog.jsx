import { useEffect } from "react"
import { X } from "lucide-react"
import { IconButton } from "./button"
import { cn } from "../../lib/utils"

const DIALOG_SIZES = {
  sm: "max-w-md",
  lg: "h-[36rem] max-w-3xl",
}

export function Dialog({ label, size = "sm", onClose, className, children }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg",
          DIALOG_SIZES[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ onClose, children }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border pl-4 pr-2">
      <div className="flex h-full min-w-0 flex-1 items-center gap-2">{children}</div>
      {onClose && <IconButton label="Close" icon={X} onClick={onClose} />}
    </div>
  )
}

export function DialogTitle({ children }) {
  return <h2 className="truncate text-sm font-semibold" title={children}>{children}</h2>
}

export function DialogBody({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [overflow-wrap:anywhere]", className)} {...props} />
}

export function DialogFooter({ children }) {
  return <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">{children}</div>
}
