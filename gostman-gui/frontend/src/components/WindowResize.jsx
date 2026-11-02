import { cn } from "../lib/utils"
import { resizeWindowFrom } from "../lib/windowControls"
import { APP_TEXT } from "../lib/appText"
import { useIsMaximised } from "../hooks/useIsMaximised"
import { useWindowFrame } from "../hooks/useWindowFrame"

const EDGES = [
  { edge: "n-resize", className: "inset-x-3 top-0 h-1.5 cursor-n-resize" },
  { edge: "s-resize", className: "inset-x-3 bottom-0 h-1.5 cursor-s-resize" },
  { edge: "w-resize", className: "inset-y-3 left-0 w-1.5 cursor-w-resize" },
  { edge: "e-resize", className: "inset-y-3 right-0 w-1.5 cursor-e-resize" },
  { edge: "nw-resize", className: "left-0 top-0 size-3 cursor-nw-resize" },
  { edge: "ne-resize", className: "right-0 top-0 size-3 cursor-ne-resize" },
  { edge: "sw-resize", className: "bottom-0 left-0 size-3 cursor-sw-resize" },
  { edge: "se-resize", className: "bottom-0 right-0 size-3 cursor-se-resize" },
]

const startResize = (edge) => (event) => {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  resizeWindowFrom(edge)
}

export const useFramelessWindow = (windowFrame) => Boolean(useWindowFrame(windowFrame)?.frameless)

export const useAdjustableWindow = (windowFrame) => Boolean(useWindowFrame(windowFrame)?.adjustable)

export function WindowEdges() {
  if (useIsMaximised()) return null
  return EDGES.map(({ edge, className }) => (
    <div key={edge} aria-hidden="true" className={cn("fixed z-[100]", className)} onMouseDown={startResize(edge)} />
  ))
}

export function ResizeGrip() {
  if (useIsMaximised()) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      title={APP_TEXT.window.resize}
      aria-label={APP_TEXT.window.resize}
      className="flex h-full w-5 shrink-0 cursor-se-resize items-end justify-end p-0.5 text-muted-foreground/60 hover:text-foreground"
      onMouseDown={startResize("se-resize")}
    >
      <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M9 3 3 9M9 6 6 9" />
      </svg>
    </button>
  )
}
