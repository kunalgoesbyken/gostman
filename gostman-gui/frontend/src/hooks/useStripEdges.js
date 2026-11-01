import { useCallback, useEffect, useState } from "react"
import { isRtl } from "./direction"

const EDGE_TOLERANCE_PX = 1
const PAGE_FRACTION = 0.6
const NO_EDGES = { start: false, end: false }

const sign = () => (isRtl() ? -1 : 1)

function edgesOf(strip) {
  const hidden = strip.scrollWidth - strip.clientWidth
  const offset = Math.abs(strip.scrollLeft)
  return { start: offset > EDGE_TOLERANCE_PX, end: hidden - offset > EDGE_TOLERANCE_PX }
}

export function useStripEdges(stripRef, watched) {
  const [edges, setEdges] = useState(NO_EDGES)

  const measure = useCallback(() => {
    const next = edgesOf(stripRef.current)
    setEdges((previous) => (previous.start === next.start && previous.end === next.end ? previous : next))
  }, [stripRef])

  useEffect(() => {
    const strip = stripRef.current
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    strip.addEventListener("scroll", measure, { passive: true })
    return () => {
      observer.disconnect()
      strip.removeEventListener("scroll", measure)
    }
  }, [stripRef, measure])

  useEffect(measure, [measure, watched])

  const page = useCallback((direction) => {
    const strip = stripRef.current
    strip.scrollBy({ left: direction * sign() * strip.clientWidth * PAGE_FRACTION, behavior: "smooth" })
  }, [stripRef])

  const scrollWithWheel = useCallback((event) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    stripRef.current.scrollBy({ left: event.deltaY * sign() })
  }, [stripRef])

  return { edges, page, scrollWithWheel }
}
