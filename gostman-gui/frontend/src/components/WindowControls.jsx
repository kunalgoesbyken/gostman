import { useCallback, useEffect, useState } from "react"
import { Copy, Minus, Square, X } from "lucide-react"
import { cn } from "../lib/utils"
import { windowControls } from "../lib/windowControls"

const BUTTON_CLASS = "inline-flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
const NO_DRAG = { "--wails-draggable": "no-drag" }

export function WindowControls() {
  const [isMaximised, setIsMaximised] = useState(false)

  const refresh = useCallback(() => {
    Promise.resolve(windowControls.isMaximised()).then(setIsMaximised).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("resize", refresh)
    return () => window.removeEventListener("resize", refresh)
  }, [refresh])

  return (
    <div className="-mr-3 flex h-full shrink-0 items-stretch" style={NO_DRAG}>
      <button type="button" aria-label="Minimize" title="Minimize" className={BUTTON_CLASS} onClick={windowControls.minimise}>
        <Minus />
      </button>
      <button
        type="button"
        aria-label={isMaximised ? "Restore" : "Maximize"}
        title={isMaximised ? "Restore" : "Maximize"}
        className={BUTTON_CLASS}
        onClick={windowControls.toggleMaximise}
      >
        {isMaximised ? <Copy className="-scale-x-100" /> : <Square />}
      </button>
      <button
        type="button"
        aria-label="Close"
        title="Close"
        className={cn(BUTTON_CLASS, "hover:bg-destructive hover:text-destructive-foreground")}
        onClick={windowControls.close}
      >
        <X />
      </button>
    </div>
  )
}
