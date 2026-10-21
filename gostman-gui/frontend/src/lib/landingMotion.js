import { useEffect, useLayoutEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

gsap.registerPlugin(ScrollTrigger)

const MOTION_OK = "(prefers-reduced-motion: no-preference)"

export { gsap }

export function useReveal(scopeRef, build) {
  useLayoutEffect(() => {
    const mm = gsap.matchMedia(scopeRef.current)
    mm.add(MOTION_OK, () => build(scopeRef.current))
    return () => mm.revert()
  }, [])
}

export function useSmoothScroll() {
  useEffect(() => {
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
  }, [])
}
