import { useRef } from "react"
import { cn } from "../../lib/utils"
import { Close, Maximize } from "./icons"

const CORNER_BUTTON = "flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/90 text-foreground"

export function ImageZoom({ src, alt, onOpen, className, children }) {
  const dialogRef = useRef(null)

  const open = () => {
    onOpen?.()
    dialogRef.current.showModal()
  }

  const close = () => dialogRef.current.close()

  return (
    <>
      <button type="button" onClick={open} aria-label={`Enlarge screenshot: ${alt}`} className={cn("group relative block w-full cursor-zoom-in text-left", className)}>
        {children}
        <span aria-hidden="true" className={cn(CORNER_BUTTON, "absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100")}>
          <Maximize className="h-4 w-4" />
        </span>
      </button>
      <dialog
        ref={dialogRef}
        aria-label={alt}
        onClick={close}
        data-lenis-prevent=""
        className="m-0 h-dvh max-h-none w-screen max-w-none overflow-auto bg-transparent p-0 backdrop:bg-background"
      >
        <div className="flex min-h-full min-w-max items-center justify-center p-4 sm:min-w-0 sm:p-8">
          <img src={src} alt={alt} loading="lazy" decoding="async" className="h-auto w-[220vw] max-w-none cursor-zoom-out rounded-lg border border-border/60 sm:max-h-[calc(100dvh-4rem)] sm:w-auto sm:max-w-full" />
        </div>
        <button type="button" onClick={close} aria-label="Close" className={cn(CORNER_BUTTON, "fixed right-4 top-4")}>
          <Close className="h-4 w-4" />
        </button>
      </dialog>
    </>
  )
}
