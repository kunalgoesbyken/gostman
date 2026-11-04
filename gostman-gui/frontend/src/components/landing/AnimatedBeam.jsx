import { useEffect, useId, useState } from "react"
import { m, useInView, useReducedMotion } from "framer-motion"
import { easeOutExpo } from "../../lib/motion"
import { cn } from "../../lib/utils"

const TAIL = 0.3

const centerOf = (element, origin) => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left - origin.left + rect.width / 2, y: rect.top - origin.top + rect.height / 2 }
}

function measure(container, from, to) {
  const origin = container.getBoundingClientRect()
  return { width: origin.width, height: origin.height, start: centerOf(from, origin), end: centerOf(to, origin) }
}

const axisSweep = (start, end) => {
  const tail = (end - start) * TAIL
  return { lead: [start, end + tail], trail: [start - tail, end] }
}

function sweep({ start, end }) {
  const x = axisSweep(start.x, end.x)
  const y = axisSweep(start.y, end.y)
  return { x1: x.lead, x2: x.trail, y1: y.lead, y2: y.trail }
}

const restingPoint = ({ start }) => ({ x1: start.x, x2: start.x, y1: start.y, y2: start.y })

export function AnimatedBeam({ containerRef, fromRef, toRef, className, delay = 0, duration = 3, repeatDelay = 1 }) {
  const id = useId()
  const isStill = useReducedMotion()
  const isVisible = useInView(containerRef)
  const [geometry, setGeometry] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    const observer = new ResizeObserver(() => setGeometry(measure(container, fromRef.current, toRef.current)))
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, fromRef, toRef])

  if (!geometry) return null
  const { width, height, start, end } = geometry
  const path = `M ${start.x},${start.y} L ${end.x},${end.y}`

  return (
    <svg aria-hidden="true" fill="none" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("pointer-events-none absolute left-0 top-0", className)}>
      <path d={path} className="stroke-border" strokeWidth="2" strokeLinecap="round" />
      {isVisible && !isStill && (
        <>
          <path d={path} stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
          <defs>
            <m.linearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={restingPoint(geometry)}
              animate={sweep(geometry)}
              transition={{ delay, duration, ease: easeOutExpo, repeat: Infinity, repeatDelay }}
            >
              <stop stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.1" stopColor="currentColor" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </m.linearGradient>
          </defs>
        </>
      )}
    </svg>
  )
}
