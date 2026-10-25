import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { ContextMenu } from "../ui/ContextMenu"
import { FlowNode, iconOf } from "./FlowNode"
import { FLOW_CANVAS_TEXT as TEXT, FLOW_KIND_TEXT, FLOW_VIEW_TEXT } from "../../lib/flowsText"
import { fallsThrough, jumpsOf } from "../../lib/flows/describe"
import { STEP_FOR_EACH, STEP_KINDS, STEP_REQUEST, indexSteps } from "../../lib/flows/model"
import { stepTitle } from "../../lib/flows/validate"
import { ORIENTATION, moveFocus } from "../../lib/rovingFocus"
import { isRemoveKey } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"

const NODE_KEYS = { selector: "[data-step-node]", orientation: ORIENTATION.vertical }
const MOVE_KEYS = { ArrowUp: -1, ArrowDown: 1 }
const LANE_GAP = 14
const LANE_START = 22
const CORNER = 6
const MUTED_EDGE = { stroke: "stroke-muted-foreground", fill: "fill-muted-foreground" }
const EDGE_TONES = {
  onFailure: { stroke: "stroke-destructive", fill: "fill-destructive" },
  then: { stroke: "stroke-success", fill: "fill-success" },
  else: MUTED_EDGE,
  next: MUTED_EDGE,
}
const SOURCE_SHARE = { then: 0.38, next: 0.5, onFailure: 0.72, else: 0.72 }

const relativeBox = (element, origin) => {
  const rect = element.getBoundingClientRect()
  return { left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top, height: rect.height }
}

function measure(container) {
  const origin = container.getBoundingClientRect()
  const nodes = {}
  const loops = {}
  container.querySelectorAll("[data-step-node]").forEach((element) => { nodes[element.dataset.stepNode] = relativeBox(element, origin) })
  container.querySelectorAll("[data-loop-body]").forEach((element) => { loops[element.dataset.loopBody] = relativeBox(element, origin) })
  const right = Math.max(0, ...Object.values(nodes).map((box) => box.right))
  return { nodes, loops, right, width: container.scrollWidth, height: container.scrollHeight }
}

function followingId(index, id) {
  const entry = index.get(id)
  return entry && entry.position + 1 < entry.list.length ? entry.list[entry.position + 1].id : ""
}

function drawnJumps(steps, index) {
  const jumps = []
  index.forEach(({ step }) => {
    jumpsOf(step).forEach((jump) => {
      const isFallThrough = jump.field === "next" && jump.to === followingId(index, step.id)
      if (!jump.toEnd && index.has(jump.to) && !isFallThrough) jumps.push(jump)
    })
  })
  return jumps
}

function assignLanes(jumps, boxes) {
  const lanes = []
  return jumps
    .map((jump) => {
      const source = boxes.nodes[jump.from]
      const target = boxes.nodes[jump.to]
      if (!source || !target) return null
      const sourceY = source.top + source.height * SOURCE_SHARE[jump.field]
      const targetY = target.top + 14
      return { ...jump, sourceY, targetY, sourceX: source.right, targetX: target.right, low: Math.min(sourceY, targetY), high: Math.max(sourceY, targetY) }
    })
    .filter(Boolean)
    .sort((first, second) => (first.high - first.low) - (second.high - second.low))
    .map((jump) => {
      let lane = lanes.findIndex((taken) => taken.every((other) => other.high + 6 < jump.low || other.low - 6 > jump.high))
      if (lane < 0) lane = lanes.push([]) - 1
      lanes[lane].push(jump)
      return { ...jump, x: boxes.right + LANE_START + lane * LANE_GAP }
    })
}

function jumpPath({ sourceX, sourceY, targetX, targetY, x }) {
  const down = targetY > sourceY ? 1 : -1
  return [
    `M ${sourceX} ${sourceY}`,
    `H ${x - CORNER}`,
    `Q ${x} ${sourceY} ${x} ${sourceY + down * CORNER}`,
    `V ${targetY - down * CORNER}`,
    `Q ${x} ${targetY} ${x - CORNER} ${targetY}`,
    `H ${targetX + 6}`,
  ].join(" ")
}

const arrowLeft = (x, y) => `${x},${y} ${x + 6},${y - 3.5} ${x + 6},${y + 3.5}`
const arrowRight = (x, y) => `${x},${y} ${x - 6},${y - 3.5} ${x - 6},${y + 3.5}`

const LABEL_STYLE = { paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 3, fontSize: 10 }

function Jump({ jump }) {
  const tone = EDGE_TONES[jump.field]
  return (
    <g className={tone.stroke}>
      <path d={jumpPath(jump)} fill="none" strokeWidth={1.25} />
      <polygon points={arrowLeft(jump.targetX, jump.targetY)} className={tone.fill} stroke="none" />
      <text x={jump.sourceX + 6} y={jump.sourceY - 4} className={tone.fill} style={LABEL_STYLE}>{jump.label}</text>
    </g>
  )
}

function RetryLoop({ box, times }) {
  const { left, top, bottom } = box
  const low = bottom - 12
  const high = top + 12
  return (
    <g className="stroke-muted-foreground">
      <path d={`M ${left} ${low} C ${left - 26} ${low} ${left - 26} ${high} ${left - 6} ${high}`} fill="none" strokeWidth={1.25} />
      <polygon points={arrowRight(left, high)} className="fill-muted-foreground" stroke="none" />
      <text x={left - 24} y={(low + high) / 2 + 3} textAnchor="end" className="fill-muted-foreground" style={LABEL_STYLE}>{TEXT.retryShort(times)}</text>
    </g>
  )
}

function LoopBack({ box }) {
  const x = box.left - 10
  return (
    <g className="stroke-muted-foreground">
      <path d={`M ${box.left} ${box.bottom - 10} H ${x} V ${box.top + 12} H ${box.left - 4}`} fill="none" strokeWidth={1.25} strokeDasharray="3 3" />
      <polygon points={arrowRight(box.left + 2, box.top + 12)} className="fill-muted-foreground" stroke="none" />
    </g>
  )
}

function Connectors({ boxes, steps, index }) {
  const jumps = useMemo(() => assignLanes(drawnJumps(steps, index), boxes), [steps, index, boxes])
  const retries = []
  index.forEach(({ step }) => {
    if (step.kind === STEP_REQUEST && step.retry.times > 1 && boxes.nodes[step.id]) retries.push(step)
  })
  return (
    <svg aria-hidden="true" width={boxes.width} height={boxes.height} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      {Object.entries(boxes.loops).map(([id, box]) => <LoopBack key={id} box={box} />)}
      {retries.map((step) => <RetryLoop key={step.id} box={boxes.nodes[step.id]} times={step.retry.times} />)}
      {jumps.map((jump) => <Jump key={`${jump.from}-${jump.field}`} jump={jump} />)}
    </svg>
  )
}

function slotLabel(previous, parentTitle) {
  if (previous) return TEXT.insert
  return parentTitle ? TEXT.insertInto(parentTitle) : TEXT.addFirst
}

function Slot({ previous, parentTitle, onAdd }) {
  const isFlowing = previous ? fallsThrough(previous) : true
  const label = slotLabel(previous, parentTitle)
  return (
    <div className="relative flex h-9 w-[17rem] max-w-full justify-center">
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-1/2 border-l", isFlowing ? "border-border" : "border-dashed border-border/60")} />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(event) => onAdd(event.currentTarget)}
        className="relative z-[1] my-auto flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus aria-hidden="true" className="h-3 w-3" />
      </button>
    </div>
  )
}

function StepList({ steps, parent, parentTitle, view }) {
  return (
    <div className="flex flex-col items-start">
      {steps.map((step, position) => (
        <div key={step.id} className="flex flex-col items-start">
          <Slot previous={steps[position - 1]} parentTitle={parentTitle} onAdd={(anchor) => view.onAdd(anchor, { parent, position })} />
          <FlowNode
            step={step}
            position={view.positions.get(step.id)}
            count={view.positions.size}
            context={view.context}
            node={view.nodes[step.id]}
            problem={view.problems.get(step.id)}
            isSelected={view.selected === step.id}
            onSelect={view.onSelect}
            onOpen={view.onOpen}
            onKeyDown={view.onKeyDown}
          />
          {step.kind === STEP_FOR_EACH && (
            <div data-loop-body={step.id} className="ml-6 mt-1 flex flex-col items-start rounded-md border border-dashed border-border px-3 pb-2 pt-1">
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">{TEXT.loopBody}</span>
              <StepList steps={step.steps} parent={step.id} parentTitle={stepTitle(step, view.context.requests)} view={view} />
            </div>
          )}
        </div>
      ))}
      <Slot previous={steps[steps.length - 1]} parentTitle={parentTitle} onAdd={(anchor) => view.onAdd(anchor, { parent, position: steps.length })} />
    </div>
  )
}

const kindItems = (onChoose) => STEP_KINDS.map((kind) => ({ id: kind, label: FLOW_KIND_TEXT[kind].label, icon: iconOf(kind), onSelect: () => onChoose(kind) }))

export function FlowCanvas({ flow, context, nodes, problems, selected, onSelect, onOpen, onInsert, onRemove, onMove }) {
  const containerRef = useRef(null)
  const [boxes, setBoxes] = useState(null)
  const [menu, setMenu] = useState(null)
  const index = useMemo(() => indexSteps(flow.steps), [flow.steps])
  const positions = useMemo(() => new Map([...index.keys()].map((id, at) => [id, at + 1])), [index])

  useLayoutEffect(() => {
    const container = containerRef.current
    const update = () => setBoxes(measure(container))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [flow, nodes, selected])

  const onKeyDown = useCallback((event, id) => {
    if (isRemoveKey(event)) {
      event.preventDefault()
      onRemove(id)
      return
    }
    if (event.altKey && MOVE_KEYS[event.key]) {
      event.preventDefault()
      onMove(id, MOVE_KEYS[event.key])
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      onOpen(id)
      return
    }
    moveFocus(event, NODE_KEYS)
  }, [onMove, onOpen, onRemove])

  const onAdd = useCallback((anchor, place) => {
    const rect = anchor.getBoundingClientRect()
    setMenu({ place, position: { x: rect.left, y: rect.bottom + 4 } })
  }, [])

  const view = { context, nodes, problems, selected, positions, onSelect, onOpen, onKeyDown, onAdd }

  return (
    <div ref={containerRef} role="group" aria-label={TEXT.canvasLabel(flow.name)} className="relative min-h-full w-max min-w-full pb-16 pl-20 pr-32 pt-4">
      <span className="mb-1 inline-flex h-5 items-center rounded-full border border-border px-2 text-2xs text-muted-foreground">{FLOW_VIEW_TEXT.start}</span>
      <StepList steps={flow.steps} parent="" parentTitle="" view={view} />
      {boxes && <Connectors boxes={boxes} steps={flow.steps} index={index} />}
      {menu && (
        <ContextMenu
          position={menu.position}
          title={TEXT.chooseKind}
          items={kindItems((kind) => onInsert(menu.place, kind))}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
