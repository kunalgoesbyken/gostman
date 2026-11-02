import { useEffect, useMemo, useRef, useState } from 'react'
import { HEX_ROW_BYTES, hexRow, rowCount, visibleRange } from '../lib/hexRows'
import { RESPONSE_TEXT } from '../lib/responseText'

const ROW_HEIGHT_PX = 18
const OVERSCAN_ROWS = 20
const FALLBACK_HEIGHT_PX = 480
const COLUMNS = Array.from({ length: HEX_ROW_BYTES }, (_, index) => index.toString(16).padStart(2, '0'))

function useViewport(ref) {
  const [viewport, setViewport] = useState({ top: 0, height: FALLBACK_HEIGHT_PX })

  useEffect(() => {
    const element = ref.current
    const measure = () => setViewport({ top: element.scrollTop, height: element.clientHeight || FALLBACK_HEIGHT_PX })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    element.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', measure)
    }
  }, [ref])

  return viewport
}

function HexLine({ bytes, index }) {
  const { offset, cells, ascii } = hexRow(bytes, index)
  return (
    <div className="flex whitespace-pre" style={{ height: ROW_HEIGHT_PX }}>
      <span className="w-[9ch] shrink-0 text-muted-foreground">{offset}</span>
      <span className="w-[49ch] shrink-0 text-foreground">{cells.join(' ')}</span>
      <span className="text-syntax-string">{ascii}</span>
    </div>
  )
}

export function HexView({ bytes }) {
  const ref = useRef(null)
  const { top, height } = useViewport(ref)
  const total = rowCount(bytes)
  const { first, last } = useMemo(() => visibleRange(top, height, ROW_HEIGHT_PX, total, OVERSCAN_ROWS), [top, height, total])
  const lines = []
  for (let index = first; index < last; index += 1) lines.push(<HexLine key={index} bytes={bytes} index={index} />)
  return (
    <div ref={ref} dir="ltr" role="region" aria-label={RESPONSE_TEXT.hex.label} tabIndex={0} className="h-full overflow-auto p-3 font-mono text-xs leading-[18px]">
      <div className="sticky top-[-0.75rem] z-10 -mx-3 -mt-3 mb-1 flex whitespace-pre border-b border-border bg-background px-3 py-1 text-muted-foreground" style={{ height: ROW_HEIGHT_PX + 8 }}>
        <span className="w-[9ch] shrink-0">{RESPONSE_TEXT.hex.offset}</span>
        <span className="w-[49ch] shrink-0">{COLUMNS.join(' ')}</span>
        <span>{RESPONSE_TEXT.hex.text}</span>
      </div>
      <div className="relative min-w-max" style={{ height: total * ROW_HEIGHT_PX }}>
        <div className="absolute inset-x-0" style={{ top: first * ROW_HEIGHT_PX }}>{lines}</div>
      </div>
    </div>
  )
}
