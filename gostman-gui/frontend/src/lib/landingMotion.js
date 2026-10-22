import { useEffect } from "react"

const MOTION_OK = "(prefers-reduced-motion: no-preference)"

const loadEngine = () => import("./landingMotionEngine")

function useMotionEngine(start) {
  useEffect(() => {
    let active = true
    let stop = null
    loadEngine().then((engine) => {
      if (active) stop = start(engine)
    })
    return () => {
      active = false
      stop?.()
    }
  }, [])
}

export function useReveal(scopeRef, build) {
  useMotionEngine(({ gsap }) => {
    const mm = gsap.matchMedia(scopeRef.current)
    mm.add(MOTION_OK, () => build(gsap, scopeRef.current))
    return () => mm.revert()
  })
}

export function useSmoothScroll() {
  useMotionEngine(({ gsap, ScrollTrigger, Lenis }) => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      const lenis = new Lenis({ lerp: 0.1 })
      const tick = (time) => lenis.raf(time * 1000)
      lenis.on("scroll", ScrollTrigger.update)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      return () => {
        gsap.ticker.remove(tick)
        gsap.ticker.lagSmoothing(500, 33)
        lenis.destroy()
      }
    })

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener("load", refresh)
    document.fonts?.ready.then(refresh)

    return () => {
      window.removeEventListener("load", refresh)
      mm.revert()
    }
  })
}
