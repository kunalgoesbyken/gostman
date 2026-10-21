import { useEffect, useMemo, useRef } from 'react'

const MARK_CLASS = 'rounded-sm bg-[hsl(var(--warning)/0.3)] text-foreground'
const ACTIVE_MARK_CLASS = 'rounded-sm bg-warning text-background'

export function HighlightedText({ text, matches, length, activeIndex }) {
  const activeRef = useRef(null)

  const parts = useMemo(() => {
    const nodes = []
    let cursor = 0
    matches.forEach((start, position) => {
      if (start < cursor) return
      if (start > cursor) nodes.push(text.slice(cursor, start))
      nodes.push({ position, text: text.slice(start, start + length) })
      cursor = start + length
    })
    if (cursor < text.length) nodes.push(text.slice(cursor))
    return nodes
  }, [text, matches, length])

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'center' })
  }, [activeIndex, parts])

  return parts.map((part, key) => {
    if (typeof part === 'string') return part
    const isActive = part.position === activeIndex
    return (
      <mark key={key} ref={isActive ? activeRef : undefined} className={isActive ? ACTIVE_MARK_CLASS : MARK_CLASS}>
        {part.text}
      </mark>
    )
  })
}
