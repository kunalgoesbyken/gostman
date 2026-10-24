import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"

const OVERSCAN_ROWS = 8

export function scrollIndexIntoView(container, index, rowHeight) {
  const top = index * rowHeight
  if (top < container.scrollTop) container.scrollTop = top
  else if (top + rowHeight > container.scrollTop + container.clientHeight) container.scrollTop = top + rowHeight - container.clientHeight
}

export function VirtualList({ items, rowHeight, renderRow, className, scrollRef, pinnedIndex = -1, ...props }) {
  const ownRef = useRef(null)
  const containerRef = scrollRef || ownRef
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
  const currentScrollTop = containerRef.current?.scrollTop ?? scrollTop
  const visibleTop = Math.min(currentScrollTop, Math.max(0, totalHeight - viewportHeight))
  const first = Math.max(0, Math.floor(visibleTop / rowHeight) - OVERSCAN_ROWS)
  const last = Math.min(items.length, Math.ceil((visibleTop + viewportHeight) / rowHeight) + OVERSCAN_ROWS)
  const isPinnedHidden = pinnedIndex >= 0 && pinnedIndex < items.length && (pinnedIndex < first || pinnedIndex >= last)

  return (
    <div
      ref={containerRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className={cn("overflow-y-auto", className)}
      {...props}
    >
      <div className="relative" style={{ height: totalHeight, paddingTop: first * rowHeight }}>
        {items.slice(first, last).map(renderRow)}
        {isPinnedHidden && (
          <div className="absolute inset-x-0" style={{ top: pinnedIndex * rowHeight }}>
            {renderRow(items[pinnedIndex])}
          </div>
        )}
      </div>
    </div>
  )
}
