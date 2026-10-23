import { useEffect } from "react"
import { whenIdle } from "./idle"

const MOTION_OK = "(prefers-reduced-motion: no-preference)"
const IN_PAGE_LINK = 'a[href^="#"]'

const anchorOffset = () => -parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

const layOutSectionsBeforeJump = (lenis) => (event) => {
  if (!event.target.closest?.(IN_PAGE_LINK)) return
  document.documentElement.dataset.anchorJumped = ""
  lenis.resize()
}

export function useSmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches) return undefined
    let active = true
    let lenis = null
    let beforeJump = null
    const cancel = whenIdle(() =>
      import("lenis").then(({ default: Lenis }) => {
        if (!active) return
        lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: anchorOffset() } })
        beforeJump = layOutSectionsBeforeJump(lenis)
        window.addEventListener("click", beforeJump, true)
      })
    )
    return () => {
      active = false
      cancel()
      if (beforeJump) window.removeEventListener("click", beforeJump, true)
      lenis?.destroy()
    }
  }, [])
}
