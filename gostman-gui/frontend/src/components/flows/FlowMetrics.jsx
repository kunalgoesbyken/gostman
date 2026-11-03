import { DataTable } from "../ui/dataTable"
import { DisclosureSummary } from "../ui/disclosure"
import { FLOW_METRICS_TEXT as TEXT } from "../../lib/flowsText"
import { formatBytes } from "../../lib/byteSize"
import { formatNumber } from "../../lib/i18n/format"
import { formatMs } from "../../lib/timeline"

const SLOWEST_SHOWN = 5

const COLUMNS = [
  { get header() { return TEXT.columns.step }, key: "title", width: "w-[34%]", cellClassName: "font-sans text-foreground" },
  { get header() { return TEXT.columns.count }, text: (row) => formatNumber(row.count) },
  { get header() { return TEXT.columns.total }, text: (row) => formatMs(row.totalMs) },
  { get header() { return TEXT.columns.min }, text: (row) => formatMs(row.minMs) },
  { get header() { return TEXT.columns.max }, text: (row) => formatMs(row.maxMs) },
  { get header() { return TEXT.columns.average }, text: (row) => formatMs(row.totalMs / row.count) },
]

const slowestSteps = (steps) => Object.entries(steps)
  .map(([id, step]) => ({ ...step, title: step.title || id }))
  .sort((first, second) => second.totalMs - first.totalMs)
  .slice(0, SLOWEST_SHOWN)

function Figure({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-2xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}

export function FlowMetrics({ metrics }) {
  if (!metrics) return null
  const slowest = slowestSteps(metrics.steps)
  return (
    <details open className="group shrink-0 border-b border-border">
      <DisclosureSummary className="px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{TEXT.title}</DisclosureSummary>
      <dl className="grid grid-cols-4 gap-2 px-3 pb-2 max-sm:grid-cols-2">
        <Figure label={TEXT.totalTime} value={formatMs(metrics.totalMs)} />
        <Figure label={TEXT.requests} value={formatNumber(metrics.sends)} />
        <Figure label={TEXT.sent} value={formatBytes(metrics.bytesSent)} />
        <Figure label={TEXT.received} value={formatBytes(metrics.bytesReceived)} />
      </dl>
      {slowest.length > 0 && (
        <div aria-label={TEXT.slowest} role="region" className="overflow-x-auto pb-1">
          <div className="min-w-[24rem]">
            <DataTable columns={COLUMNS} rows={slowest} />
          </div>
        </div>
      )}
    </details>
  )
}
