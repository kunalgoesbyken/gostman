import { MONITORS_TEXT } from "../lib/monitorsText"

const WIDTH = 400
const PAD = 8
const MARKER_Y = 8
const RATE_TOP = 20
const RATE_HEIGHT = 36
const DURATION_TOP = 78
const DURATION_HEIGHT = 36
const HEIGHT = 124
const SHOWN_RUNS = 60

const xAt = (index, count) => (count < 2 ? WIDTH / 2 : PAD + (index * (WIDTH - PAD * 2)) / (count - 1))

const line = (points) => points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")

function Axis({ top, height }) {
  return <line x1={PAD} x2={WIDTH - PAD} y1={top + height} y2={top + height} className="stroke-border" strokeWidth="1" />
}

export function MonitorChart({ points }) {
  const shown = points.slice(-SHOWN_RUNS)
  const slowest = Math.max(1, ...shown.map((point) => point.p95Ms))
  const rate = shown.map((point, index) => [xAt(index, shown.length), RATE_TOP + RATE_HEIGHT * (1 - point.passRate)])
  const duration = shown.map((point, index) => [xAt(index, shown.length), DURATION_TOP + DURATION_HEIGHT * (1 - point.p95Ms / slowest)])

  return (
    <figure className="m-0">
      <svg role="img" aria-label={MONITORS_TEXT.chartLabel(shown.length)} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full max-w-full">
        <Axis top={RATE_TOP} height={RATE_HEIGHT} />
        <Axis top={DURATION_TOP} height={DURATION_HEIGHT} />
        {shown.map((point, index) => (
          <rect
            key={point.id}
            x={xAt(index, shown.length) - 1.5}
            y={MARKER_Y - 3}
            width="3"
            height="6"
            className={point.passed ? "fill-success" : "fill-destructive"}
          />
        ))}
        <path d={line(rate)} fill="none" strokeWidth="1.5" className="stroke-foreground" strokeLinejoin="round" />
        <path d={line(duration)} fill="none" strokeWidth="1.5" className="stroke-muted-foreground" strokeLinejoin="round" />
        {shown.length === 1 && rate.map(([x, y]) => <circle key="rate" cx={x} cy={y} r="2" className="fill-foreground" />)}
        {shown.length === 1 && duration.map(([x, y]) => <circle key="duration" cx={x} cy={y} r="2" className="fill-muted-foreground" />)}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-0.5 text-2xs text-muted-foreground">
        <span>{MONITORS_TEXT.chartPassRate}</span>
        <span>{MONITORS_TEXT.chartDuration}</span>
      </figcaption>
    </figure>
  )
}
