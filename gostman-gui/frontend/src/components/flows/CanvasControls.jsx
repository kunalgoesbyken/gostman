import { useLayoutEffect, useRef, useState } from "react"
import { Maximize, Minus, Plus } from "lucide-react"
import { MarkdownView } from "../MarkdownView"
import { FLOW_CANVAS_TEXT as TEXT } from "../../lib/flowsText"
import { formatPercent } from "../../lib/i18n/format"
import { cn } from "../../lib/utils"

const NOTE_WIDTH = 320
const NOTE_GAP = 8
const HIDDEN_LEFT = -9999
const CONTROL = "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function notePlace(anchor, height) {
  const rect = anchor.getBoundingClientRect()
  const fitsRight = rect.right + NOTE_GAP + NOTE_WIDTH < window.innerWidth - NOTE_GAP
  const left = fitsRight ? rect.right + NOTE_GAP : Math.max(NOTE_GAP, rect.left - NOTE_GAP - NOTE_WIDTH)
  const lowest = Math.max(NOTE_GAP, window.innerHeight - height - NOTE_GAP)
  return { left, top: Math.min(Math.max(rect.top, NOTE_GAP), lowest) }
}

export function NoteHint({ id, note, anchor, onEnter, onLeave }) {
  const ref = useRef(null)
  const [place, setPlace] = useState(null)
  useLayoutEffect(() => setPlace(notePlace(anchor, ref.current.offsetHeight)), [anchor, note])
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-surface="menu"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      style={{ left: place?.left ?? HIDDEN_LEFT, top: place?.top ?? 0, width: NOTE_WIDTH }}
      className="fixed z-40 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-background p-3 text-foreground shadow-lg"
    >
      <MarkdownView source={note} className="text-xs" />
    </div>
  )
}

function ZoomButton({ label, onClick, className, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn(CONTROL, className)}>
      {children}
    </button>
  )
}

function FitButton({ hidden, onFit }) {
  if (hidden === 0) return <ZoomButton label={TEXT.fit} onClick={onFit}><Maximize aria-hidden="true" className="h-3.5 w-3.5" /></ZoomButton>
  return (
    <button type="button" title={TEXT.fit} onClick={onFit} className={cn(CONTROL, "gap-1.5 text-xs text-foreground")}>
      <Maximize aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {TEXT.showHidden(hidden)}
    </button>
  )
}

export function ZoomBar({ scale, step, hidden, onZoom, onFit, onReset }) {
  return (
    <div role="toolbar" aria-label={TEXT.zoomControls} data-canvas-control className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
      <ZoomButton label={TEXT.zoomOut} onClick={() => onZoom(1 / step)}><Minus aria-hidden="true" className="h-3.5 w-3.5" /></ZoomButton>
      <ZoomButton label={TEXT.actualSize} onClick={onReset} className="w-12 font-mono text-2xs tabular-nums">{formatPercent(scale)}</ZoomButton>
      <ZoomButton label={TEXT.zoomIn} onClick={() => onZoom(step)}><Plus aria-hidden="true" className="h-3.5 w-3.5" /></ZoomButton>
      <span aria-hidden="true" className="mx-0.5 h-4 border-s border-border" />
      <FitButton hidden={hidden} onFit={onFit} />
    </div>
  )
}
