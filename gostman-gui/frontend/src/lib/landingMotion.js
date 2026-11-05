import { useEffect } from "react"

const MOTION_OK = "(prefers-reduced-motion: no-preference)"
const FINE_POINTER = "(hover: hover) and (pointer: fine)"
const IN_PAGE_LINK = 'a[href^="#"]'
const FIRST_INPUTS = ["wheel", "keydown", "pointermove", "pointerdown"]

const anchorOffset = () => -parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0

const wantsSmoothScroll = () => window.matchMedia(MOTION_OK).matches && window.matchMedia(FINE_POINTER).matches

function onFirstInput(task) {
  const start = () => {
    stop()
    task()
  }
  const stop = () => FIRST_INPUTS.forEach((type) => window.removeEventListener(type, start, true))
  FIRST_INPUTS.forEach((type) => window.addEventListener(type, start, { capture: true, passive: true }))
  return stop
}

export function useSmoothScroll() {
  useEffect(() => {
    let active = true
    let lenis = null
    const layOutSectionsBeforeJump = (event) => {
      if (!event.target.closest?.(IN_PAGE_LINK)) return
      document.documentElement.dataset.anchorJumped = ""
      lenis?.resize()
    }
    window.addEventListener("click", layOutSectionsBeforeJump, true)
    const cancel = wantsSmoothScroll()
      ? onFirstInput(() =>
          import("lenis").then(({ default: Lenis }) => {
            if (active) lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: anchorOffset() } })
          })
        )
      : () => {}
    return () => {
      active = false
      cancel()
      window.removeEventListener("click", layOutSectionsBeforeJump, true)
      lenis?.destroy()
    }
  }, [])
}
