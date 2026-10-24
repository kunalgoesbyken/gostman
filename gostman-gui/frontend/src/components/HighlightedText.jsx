import { useEffect, useMemo, useRef } from 'react'
import { firstAtOrAfter } from '../lib/largeText'

const MARK_CLASS = 'rounded-sm bg-[hsl(var(--warning)/0.3)] text-foreground'
const ACTIVE_MARK_CLASS = 'rounded-sm bg-warning text-background'

export function markedSegments(text, start, end, { matches, length, index }, activeRef) {
  const segments = []
  let cursor = start
  for (let position = firstAtOrAfter(matches, start - length + 1); position < matches.length && matches[position] < end; position += 1) {
    const from = Math.max(matches[position], cursor)
    const to = Math.min(matches[position] + length, end)
    if (from > cursor) segments.push(text.slice(cursor, from))
    const isActive = position === index
    segments.push(
      <mark key={position} ref={isActive ? activeRef : undefined} className={isActive ? ACTIVE_MARK_CLASS : MARK_CLASS}>
        {text.slice(from, to)}
      </mark>
    )
    cursor = to
  }
  if (cursor < end) segments.push(text.slice(cursor, end))
  return segments
}

export function HighlightedText({ text, matches, length, activeIndex }) {
  const activeRef = useRef(null)

  const segments = useMemo(
    () => markedSegments(text, 0, text.length, { matches, length, index: activeIndex }, activeRef),
    [text, matches, length, activeIndex]
  )

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'center' })
  }, [segments])

  return segments
}

export function MarkedRanges({ text, ranges }) {
  if (ranges.length === 0) return text
  const segments = []
  let cursor = 0
  for (const { start, end } of ranges) {
    if (start > cursor) segments.push(text.slice(cursor, start))
    segments.push(<mark key={start} className={MARK_CLASS}>{text.slice(start, end)}</mark>)
    cursor = end
  }
  if (cursor < text.length) segments.push(text.slice(cursor))
  return segments
}
