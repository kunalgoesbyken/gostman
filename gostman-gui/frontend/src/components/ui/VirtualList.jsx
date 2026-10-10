import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"

const OVERSCAN_ROWS = 8

export function VirtualList({ items, rowHeight, renderRow, className, ...props }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = () => setViewportHeight(container.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const totalHeight = items.length * rowHeight
  const visibleTop = Math.min(scrollTop, Math.max(0, totalHeight - viewportHeight))
  const first = Math.max(0, Math.floor(visibleTop / rowHeight) - OVERSCAN_ROWS)
  const last = Math.min(items.length, Math.ceil((visibleTop + viewportHeight) / rowHeight) + OVERSCAN_ROWS)

  return (
    <div
      ref={containerRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className={cn("overflow-y-auto", className)}
      {...props}
    >
      <div style={{ height: totalHeight, paddingTop: first * rowHeight }}>
        {items.slice(first, last).map(renderRow)}
      </div>
    </div>
  )
}
