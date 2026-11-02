import { layoutGraph, NODE_WIDTH_PX, ROW_PX, truncated } from "../lib/dependencies/layout"
import { STATUS_MISSING } from "../lib/dependencies/graph"
import { DEPENDENCIES_TEXT } from "../lib/dependenciesText"

const NODE_HEIGHT_PX = ROW_PX - 6
const TEXT_INSET_PX = 8
const CURVE_RATIO = 0.5

const curve = ({ from, to }) => {
  const middle = from.x + (to.x - from.x) * CURVE_RATIO
  return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`
}

const nameOf = (request) => request?.name || request?.url || DEPENDENCIES_TEXT.untitled

function Node({ node, label, title, tone, onActivate }) {
  const interactive = Boolean(onActivate)
  const handleKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onActivate()
    }
  }
  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? title : undefined}
      onClick={onActivate}
      onKeyDown={interactive ? handleKey : undefined}
      className={interactive ? "cursor-pointer outline-none focus-visible:[&>rect]:stroke-primary" : undefined}
    >
      <title>{title}</title>
      <rect width={NODE_WIDTH_PX} height={NODE_HEIGHT_PX} rx="4" className={tone} />
      <text x={TEXT_INSET_PX} y={NODE_HEIGHT_PX / 2} dominantBaseline="central" className="fill-foreground font-mono text-[11px]">{truncated(label)}</text>
    </g>
  )
}

const REQUEST_TONE = "fill-card stroke-border"
const VARIABLE_TONE = "fill-muted stroke-border"
const MISSING_TONE = "fill-card stroke-warning [stroke-dasharray:4_3]"

export function DependencyGraph({ variables, requestsById, onOpenRequest }) {
  const { producerNodes, variableNodes, consumerNodes, edges, width, height } = layoutGraph(variables)
  const requestNode = (node) => {
    const request = requestsById.get(node.id)
    return (
      <Node key={`${node.x}:${node.id}`} node={node} label={nameOf(request)} title={DEPENDENCIES_TEXT.openRequest(nameOf(request))} tone={REQUEST_TONE} onActivate={() => onOpenRequest(node.id)} />
    )
  }
  return (
    <svg role="group" aria-label={DEPENDENCIES_TEXT.graphLabel} dir="ltr" width={width} height={height} className="block">
      {edges.map((edge) => <path key={edge.key} d={curve(edge)} className="fill-none stroke-border" strokeWidth="1.25" />)}
      {producerNodes.map(requestNode)}
      {variableNodes.map((node) => {
        const isMissing = node.variable.status === STATUS_MISSING
        const label = isMissing ? `${node.id} (${DEPENDENCIES_TEXT.missingMark})` : node.id
        return <Node key={node.id} node={node} label={label} title={label} tone={isMissing ? MISSING_TONE : VARIABLE_TONE} />
      })}
      {consumerNodes.map(requestNode)}
    </svg>
  )
}
