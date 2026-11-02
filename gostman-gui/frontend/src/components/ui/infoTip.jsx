import { useCallback, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"
import { IconButton } from "./button"
import { LIST_CLASS, useDismiss } from "./select"
import { cn } from "../../lib/utils"

const VIEWPORT_MARGIN = 8
const TIP_GAP = 4
const TIP_WIDTH = 256
const MIN_ROOM_BELOW = 120

function placeTip(anchor) {
  const { left, top, bottom } = anchor.getBoundingClientRect()
  const width = Math.min(TIP_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const below = window.innerHeight - bottom - VIEWPORT_MARGIN
  const above = top - VIEWPORT_MARGIN
  const opensUp = below < MIN_ROOM_BELOW && above > below
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)),
    width,
    maxHeight: Math.max(opensUp ? above : below, 0) - TIP_GAP,
    ...(opensUp ? { bottom: window.innerHeight - top + TIP_GAP } : { top: bottom + TIP_GAP }),
  }
}

export function InfoTip({ text, className }) {
  const [placement, setPlacement] = useState(null)
  const buttonRef = useRef(null)
  const tipRef = useRef(null)
  const tipId = useId()
  const isOpen = placement !== null

  const close = useCallback(() => setPlacement(null), [])
  useDismiss(isOpen, close, buttonRef, tipRef)

  const closeOnEscape = (event) => {
    if (event.key !== "Escape" || !isOpen) return
    event.preventDefault()
    close()
  }

  return (
    <span className={cn("inline-flex shrink-0", className)} onKeyDown={closeOnEscape}>
      <IconButton
        ref={buttonRef}
        label={text}
        icon={Info}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tipId : undefined}
        onClick={() => setPlacement(isOpen ? null : placeTip(buttonRef.current))}
      />
      {isOpen && createPortal(
        <p ref={tipRef} id={tipId} role="tooltip" data-surface="menu" style={placement} className={cn(LIST_CLASS, "p-2 text-xs font-normal normal-case tracking-normal text-foreground [overflow-wrap:anywhere]")}>
          {text}
        </p>,
        document.body
      )}
    </span>
  )
}
