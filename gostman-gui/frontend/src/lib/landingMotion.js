import { useEffect } from "react"
import { whenIdle } from "./idle"

const MOTION_OK = "(prefers-reduced-motion: no-preference)"

const anchorOffset = () => -parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

export function useSmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return undefined
    let active = true
    let lenis = null
    const cancel = whenIdle(() =>
      import("lenis").then(({ default: Lenis }) => {
        if (active) lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: anchorOffset() } })
      })
    )
    return () => {
      active = false
      cancel()
      lenis?.destroy()
    }
  }, [])
}
