import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { markedSegments } from './HighlightedText'
import { breakRows, lastAtOrBefore } from '../lib/largeText'
import { RESPONSE_TEXT } from '../lib/responseText'

const ROW_HEIGHT_PX = 20
const PADDING_PX = 12
const MIN_COLUMNS = 20
const MAX_HEIGHT_PX = 15_000_000
const OVERSCAN_ROWS = 4
const SAMPLE = 'M'.repeat(100)
const NO_MATCHES = { matches: [], length: 0, index: -1 }

function useBox(scrollRef, sampleRef) {
  const [box, setBox] = useState(null)

  useLayoutEffect(() => {
    const container = scrollRef.current
    let isLive = true
    const measure = () => {
      if (!isLive) return
      const charWidth = sampleRef.current.getBoundingClientRect().width / SAMPLE.length
      setBox({ width: container.clientWidth, height: container.clientHeight, charWidth })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    document.fonts?.ready.then(measure)
    return () => {
      isLive = false
      observer.disconnect()
    }
  }, [scrollRef, sampleRef])

  return box
}

export const LargeText = memo(function LargeText({ text, highlight }) {
  const scrollRef = useRef(null)
  const sampleRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const box = useBox(scrollRef, sampleRef)
  const marks = highlight || NO_MATCHES

  const columns = box ? Math.max(MIN_COLUMNS, Math.floor((box.width - 2 * PADDING_PX) / box.charWidth)) : 0
  const rows = useMemo(() => (columns ? breakRows(text, columns) : null), [text, columns])
  const count = rows ? rows.starts.length : 0
  const viewport = box ? box.height : 0
  const total = count * ROW_HEIGHT_PX
  const height = Math.min(total, MAX_HEIGHT_PX)
  const scale = height > viewport ? Math.max(1, (total - viewport) / (height - viewport)) : 1
  const virtualTop = scrollTop * scale
  const first = Math.max(0, Math.floor(virtualTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS)
  const last = Math.min(count, Math.ceil((virtualTop + viewport) / ROW_HEIGHT_PX) + OVERSCAN_ROWS)
  const blockTop = PADDING_PX + scrollTop - (virtualTop - first * ROW_HEIGHT_PX)

  useLayoutEffect(() => {
    scrollRef.current.scrollTop = 0
    setScrollTop(0)
  }, [text])

  const activeOffset = marks.matches[marks.index]
  useEffect(() => {
    if (activeOffset === undefined || !rows) return
    const row = lastAtOrBefore(rows.starts, activeOffset)
    const target = (row * ROW_HEIGHT_PX - (viewport - ROW_HEIGHT_PX) / 2) / scale
    scrollRef.current.scrollTop = Math.max(0, target)
  }, [activeOffset, rows, viewport, scale])

  const shown = []
  for (let row = first; row < last; row += 1) {
    shown.push(
      <div key={row} style={{ height: ROW_HEIGHT_PX, lineHeight: `${ROW_HEIGHT_PX}px` }} className="overflow-hidden whitespace-pre">
        {markedSegments(text, rows.starts[row], rows.ends[row], marks)}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="document"
      aria-label={RESPONSE_TEXT.bodyLabel}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className="relative h-full overflow-y-auto overflow-x-hidden font-mono text-xs text-foreground outline-none"
    >
      <span ref={sampleRef} aria-hidden className="invisible absolute whitespace-pre">{SAMPLE}</span>
      <div style={{ height: height + 2 * PADDING_PX }} />
      <div className="absolute inset-x-0" style={{ top: blockTop, paddingLeft: PADDING_PX, paddingRight: PADDING_PX }}>
        {shown}
      </div>
    </div>
  )
})
