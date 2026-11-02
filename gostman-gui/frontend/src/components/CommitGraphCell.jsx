import { LANE_WIDTH, NODE_RADIUS, ROW_HEIGHT, laneColor, laneX } from "../lib/commitGraph"

const MIDDLE = ROW_HEIGHT / 2

const straight = (x, from, to) => `M${x} ${from}V${to}`

const curve = (fromX, fromY, toX, toY) => {
  const bend = (fromY + toY) / 2
  return `M${fromX} ${fromY}C${fromX} ${bend} ${toX} ${bend} ${toX} ${toY}`
}

function Strokes({ row }) {
  const strokes = []
  row.top.forEach((hash, lane) => {
    if (hash === null) return
    const isNode = lane === row.node
    const joins = isNode || row.merging.includes(lane)
    strokes.push({
      key: `top-${lane}`,
      lane,
      d: joins ? curve(laneX(lane), 0, laneX(row.node), MIDDLE) : straight(laneX(lane), 0, ROW_HEIGHT),
    })
  })
  row.parentLanes.forEach((lane) => {
    strokes.push({ key: `down-${lane}`, lane, d: curve(laneX(row.node), MIDDLE, laneX(lane), ROW_HEIGHT) })
  })
  return strokes.map((stroke) => <path key={stroke.key} d={stroke.d} stroke={laneColor(stroke.lane)} strokeWidth="1.5" fill="none" />)
}

export function CommitGraphCell({ row, width }) {
  const pixelWidth = width * LANE_WIDTH
  return (
    <svg aria-hidden width={pixelWidth} height={ROW_HEIGHT} viewBox={`0 0 ${pixelWidth} ${ROW_HEIGHT}`} className="shrink-0">
      <Strokes row={row} />
      <circle cx={laneX(row.node)} cy={MIDDLE} r={NODE_RADIUS} fill={row.isMerge ? "hsl(var(--background))" : laneColor(row.node)} stroke={laneColor(row.node)} strokeWidth="1.5" />
    </svg>
  )
}
