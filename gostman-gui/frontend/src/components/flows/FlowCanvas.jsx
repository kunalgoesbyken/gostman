import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { ContextMenu } from "../ui/ContextMenu"
import { NoteHint, ZoomBar } from "./CanvasControls"
import { BranchLabel, Frame, Lines, Slot, Terminal } from "./FlowDrawing"
import { FlowNode, MAX_LINES, iconOf } from "./FlowNode"
import { OVERLAYS, ZOOM_STEP, useCanvasView, useMeasuredHeights } from "./useCanvasView"
import { FLOW_CANVAS_TEXT as TEXT, FLOW_KIND_TEXT } from "../../lib/flowsText"
import { stepLines } from "../../lib/flows/describe"
import { NODE_RUNNING, RUN_RUNNING } from "../../lib/flows/flowRunner"
import { layoutFlow, travelled } from "../../lib/flows/layout"
import { BRANCH_KINDS, STEP_KINDS, STEP_PARALLEL, indexSteps } from "../../lib/flows/model"
import { isRemoveKey } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"

const VERTICAL_KEYS = { ArrowUp: -1, ArrowDown: 1 }
const SIDE_KEYS = { ArrowLeft: -1, ArrowRight: 1 }
const EDGE_KEYS = { Home: 0, End: -1 }
const ZOOM_KEYS = { "+": ZOOM_STEP, "=": ZOOM_STEP, "-": 1 / ZOOM_STEP }
const RESET_KEY = "0"
const DISMISS_KEY = "Escape"
const NOTE_DELAY_MS = 400
const NOTE_LEAVE_MS = 150
const BASE_HEIGHT = 58
const LINE_HEIGHT = 16
const FOOTER_HEIGHT = 24
const MENU_OFFSET = 4

const estimatedHeight = (step, context, node) => (
  BASE_HEIGHT + Math.min(MAX_LINES, Math.max(1, stepLines(step, context).length)) * LINE_HEIGHT + (node ? FOOTER_HEIGHT : 0)
)

function settledNodes(run) {
  if (!run) return {}
  if (run.status === RUN_RUNNING) return run.nodes
  return Object.fromEntries(Object.entries(run.nodes).map(([id, node]) => [id, node.state === NODE_RUNNING ? { ...node, state: "" } : node]))
}

function nearestAside(boxes, current, direction) {
  const from = boxes.find((box) => box.id === current)
  if (!from) return null
  const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
  const origin = centre(from)
  const scored = boxes
    .filter((box) => box.id !== current && (centre(box).x - origin.x) * direction > from.width / 2)
    .map((box) => ({ id: box.id, score: Math.abs(centre(box).y - origin.y) * 2 + Math.abs(centre(box).x - origin.x) }))
    .sort((first, second) => first.score - second.score)
  return scored[0]?.id ?? null
}

function targetOf(event, id, order, boxes) {
  if (VERTICAL_KEYS[event.key]) return order[order.indexOf(id) + VERTICAL_KEYS[event.key]]
  if (SIDE_KEYS[event.key]) return nearestAside(boxes, id, SIDE_KEYS[event.key])
  return order.at(EDGE_KEYS[event.key])
}

const isNavigationKey = (key) => key in VERTICAL_KEYS || key in SIDE_KEYS || key in EDGE_KEYS

const nodeElement = (container, id) => container?.querySelector(`[data-step-node="${CSS.escape(id)}"]`)

const groupNotes = (endNotes) => endNotes.reduce((notes, { id, field }) => notes.set(id, [...(notes.get(id) || []), field]), new Map())

const kindsFor = (index, place) => (index.get(place?.parent)?.step.kind === STEP_PARALLEL ? BRANCH_KINDS : STEP_KINDS)

const kindItems = (kinds, onChoose) => kinds.map((kind) => ({ id: kind, label: FLOW_KIND_TEXT[kind].label, icon: iconOf(kind), onSelect: () => onChoose(kind) }))

function useNoteHint() {
  const [hint, setHint] = useState(null)
  const timer = useRef(0)

  const show = useCallback((id, anchor) => {
    clearTimeout(timer.current)
    timer.current = id
      ? setTimeout(() => setHint({ id, anchor }), NOTE_DELAY_MS)
      : setTimeout(() => setHint(null), NOTE_LEAVE_MS)
  }, [])

  const keep = useCallback(() => clearTimeout(timer.current), [])

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!hint) return undefined
    const close = (event) => {
      if (event.key === "Escape") setHint(null)
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [hint])

  return { hint, show, keep }
}

function useNodeKeys({ order, boxes, layerRef, onRemove, onMove, onOpen }) {
  return useCallback((event, id) => {
    if (isRemoveKey(event)) {
      event.preventDefault()
      onRemove(id)
      return
    }
    if (event.altKey && VERTICAL_KEYS[event.key]) {
      event.preventDefault()
      onMove(id, VERTICAL_KEYS[event.key])
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      onOpen(id)
      return
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isNavigationKey(event.key)) return
    event.preventDefault()
    const target = targetOf(event, id, order, boxes)
    if (target) nodeElement(layerRef.current, target)?.focus({ preventScroll: true })
  }, [order, boxes, layerRef, onRemove, onMove, onOpen])
}

export function FlowCanvas({ flow, viewKey, context, run, problems, selected, onSelect, onOpen, onInsert, onRemove, onMove, onBackground }) {
  const viewportRef = useRef(null)
  const layerRef = useRef(null)
  const noteId = useId()
  const [menu, setMenu] = useState(null)
  const { hint, show: showHint, keep: keepHint } = useNoteHint()
  const nodes = useMemo(() => settledNodes(run), [run])
  const index = useMemo(() => indexSteps(flow.steps), [flow.steps])
  const order = useMemo(() => [...index.keys()], [index])
  const heights = useMeasuredHeights(layerRef)
  const layout = useMemo(
    () => layoutFlow(flow.steps, { heightOf: (step) => heights[step.id] ?? estimatedHeight(step, context, nodes[step.id]) }),
    [flow.steps, heights, context, nodes]
  )
  const pairs = useMemo(() => travelled(flow.steps, run?.entries || [], Boolean(run) && run.status !== RUN_RUNNING), [flow.steps, run])
  const endNotes = useMemo(() => groupNotes(layout.endNotes), [layout])
  const boxes = useMemo(() => new Map(layout.nodes.map((box) => [box.id, box])), [layout])
  const { view, hidden, isGliding, zoomBy, fit, resetZoom, reveal, handlers } = useCanvasView(viewportRef, viewKey, layout, onBackground)
  const onKeyDown = useNodeKeys({ order, boxes: layout.nodes, layerRef, onRemove, onMove, onOpen })

  const runningId = Object.keys(nodes).find((id) => nodes[id].state === NODE_RUNNING)
  const followedId = runningId || selected

  useEffect(() => {
    if (followedId) reveal(boxes.get(followedId))
  }, [followedId])

  const onNodeFocus = useCallback((id, noted) => {
    reveal(boxes.get(id))
    if (noted) showHint(id, nodeElement(layerRef.current, id))
  }, [boxes, reveal, showHint])

  const onAdd = useCallback((anchor, place) => {
    const rect = anchor.getBoundingClientRect()
    setMenu({ place, position: { x: rect.left, y: rect.bottom + MENU_OFFSET } })
  }, [])

  const onViewportKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest(`input, textarea, ${OVERLAYS}`)) return
    if (event.key === DISMISS_KEY && !hint) {
      event.preventDefault()
      onBackground()
      return
    }
    if (ZOOM_KEYS[event.key]) {
      event.preventDefault()
      zoomBy(ZOOM_KEYS[event.key])
    }
    if (event.key === RESET_KEY) {
      event.preventDefault()
      resetZoom()
    }
  }

  const hintNote = hint && index.get(hint.id)?.step.note

  return (
    <div
      ref={viewportRef}
      role="group"
      tabIndex={-1}
      dir="ltr"
      aria-label={TEXT.canvasLabel(flow.name)}
      onKeyDown={onViewportKeyDown}
      {...handlers}
      className="relative min-h-0 min-w-0 flex-1 touch-none select-none overflow-hidden bg-muted/20 outline-none max-sm:max-h-[55%] max-sm:min-h-[45%]"
    >
      {view && (
        <div
          ref={layerRef}
          style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          className={cn("absolute left-0 top-0 origin-top-left", isGliding && "transition-transform duration-200 ease-out motion-reduce:transition-none")}
        >
          {layout.frames.map((frame) => <Frame key={frame.id} frame={frame} />)}
          <Lines layout={layout} index={index} pairs={pairs} />
          {layout.labels.map((label, at) => <BranchLabel key={at} label={label} step={index.get(label.step).step} />)}
          {layout.terminals.map((terminal) => <Terminal key={terminal.key} terminal={terminal} pairs={pairs} />)}
          {layout.nodes.map((box) => (
            <FlowNode
              key={box.id}
              step={index.get(box.id).step}
              box={box}
              position={order.indexOf(box.id) + 1}
              count={order.length}
              context={context}
              node={nodes[box.id]}
              problem={problems.get(box.id)}
              endNotes={endNotes.get(box.id) || []}
              isSelected={selected === box.id}
              describedBy={hint?.id === box.id ? noteId : undefined}
              onSelect={onSelect}
              onOpen={onOpen}
              onKeyDown={onKeyDown}
              onFocus={onNodeFocus}
              onHint={showHint}
            />
          ))}
          {layout.slots.map((slot) => (
            <Slot key={`${slot.parent}:${slot.position}:${slot.x}:${slot.y}`} slot={slot} index={index} requests={context.requests} onAdd={onAdd} />
          ))}
        </div>
      )}
      {view && <ZoomBar scale={view.scale} step={ZOOM_STEP} hidden={hidden} onZoom={zoomBy} onFit={fit} onReset={resetZoom} />}
      {hintNote && hint.anchor && <NoteHint id={noteId} note={hintNote} anchor={hint.anchor} onEnter={keepHint} onLeave={() => showHint(null)} />}
      {menu && (
        <ContextMenu
          position={menu.position}
          title={TEXT.chooseKind}
          items={kindItems(kindsFor(context.index, menu.place), (kind) => onInsert(menu.place, kind))}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
