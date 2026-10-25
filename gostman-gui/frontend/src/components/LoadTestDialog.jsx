import { Gauge, Play, Square } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { DataTable } from "./ui/dataTable"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { MethodTag } from "./MethodTag"
import { formatBytes } from "../lib/byteSize"
import { formatNumber } from "../lib/i18n/format"
import { LATENCY_ACCURACY_PERCENT, LOAD_LIMITS } from "../lib/loadTestLimits"
import { LOAD_TEST_TEXT } from "../lib/loadTestText"
import { useLoadTestStore } from "../lib/loadTestSession"
import { statusVariant } from "../lib/response"

const MS_PER_SECOND = 1000
const FRACTION_DIGITS = 1
const TOTAL_PERCENT = 100
const HISTOGRAM_HEIGHT_REM = 7
const BAR_MINIMUM_PERCENT = 1

const percentileColumns = () => [
  { header: LOAD_TEST_TEXT.percentileColumns.name, key: "name", width: "w-1/2", cellClassName: "text-foreground" },
  { header: LOAD_TEST_TEXT.percentileColumns.value, key: "value" },
]

const LOAD_TEST_WINDOW = { id: "load-test", width: 768, height: 640, minWidth: 480, minHeight: 360 }

const fixed = (number) => formatNumber(number, { minimumFractionDigits: FRACTION_DIGITS, maximumFractionDigits: FRACTION_DIGITS })

const percentileRows = (latency) => Object.entries(LOAD_TEST_TEXT.percentiles)
  .map(([key, name]) => ({ name, value: fixed(latency[key]) }))

function NumberField({ label, hint, value, max, disabled, onChange }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <Input
        type="number"
        min={0}
        max={max}
        value={value || ""}
        placeholder={hint}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="font-mono"
      />
    </label>
  )
}

function Controls({ load, actions }) {
  const { isRunning, blocked, concurrency, durationSeconds, rateLimit } = load
  return (
    <div className="flex flex-wrap items-end gap-3">
      <NumberField label={LOAD_TEST_TEXT.concurrency} max={LOAD_LIMITS.concurrency} value={concurrency} disabled={isRunning} onChange={actions.setConcurrency} />
      <NumberField label={LOAD_TEST_TEXT.duration} max={LOAD_LIMITS.durationSeconds} value={durationSeconds} disabled={isRunning} onChange={actions.setDuration} />
      <NumberField label={LOAD_TEST_TEXT.rateLimit} hint={LOAD_TEST_TEXT.rateLimitHint} value={rateLimit} disabled={isRunning} onChange={actions.setRateLimit} />
      {isRunning ? (
        <Button variant="destructive" onClick={actions.stop}>
          <Square />
          {LOAD_TEST_TEXT.stop}
        </Button>
      ) : (
        <Button disabled={Boolean(blocked) || concurrency < 1 || durationSeconds < 1} onClick={actions.start}>
          <Play />
          {LOAD_TEST_TEXT.start}
        </Button>
      )}
    </div>
  )
}

function Figure({ label, value, title }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border px-3 py-2" title={title}>
      <SectionLabel>{label}</SectionLabel>
      <span className="truncate font-mono text-sm text-foreground">{value}</span>
    </div>
  )
}

function Progress({ progress }) {
  const text = LOAD_TEST_TEXT.progress
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="status">
      <Figure label={text.elapsed} value={LOAD_TEST_TEXT.seconds(fixed(progress.elapsedMs / MS_PER_SECOND))} />
      <Figure label={text.requests} value={formatNumber(progress.total)} />
      <Figure label={text.rate} value={formatNumber(Math.round(progress.requestsPerSecond))} />
      <Figure label={text.p95} value={LOAD_TEST_TEXT.milliseconds(fixed(progress.p95Ms))} />
      <Figure label={text.failed} value={formatNumber(progress.failed)} />
    </div>
  )
}

function Histogram({ bins }) {
  const tallest = Math.max(...bins.map((bin) => bin.count), 1)
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{LOAD_TEST_TEXT.histogramLabel}</SectionLabel>
      <div className="flex items-end gap-1 border-b border-border" style={{ height: `${HISTOGRAM_HEIGHT_REM}rem` }}>
        {bins.map((bin) => (
          <div
            key={bin.fromMs}
            role="img"
            aria-label={LOAD_TEST_TEXT.histogramBarLabel(bin)}
            title={LOAD_TEST_TEXT.histogramBarLabel(bin)}
            className="min-w-0 flex-1 bg-primary"
            style={{ height: `${Math.max((bin.count / tallest) * TOTAL_PERCENT, bin.count > 0 ? BAR_MINIMUM_PERCENT : 0)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-2xs text-muted-foreground">
        <span>{LOAD_TEST_TEXT.milliseconds(fixed(bins[0].fromMs))}</span>
        <span>{LOAD_TEST_TEXT.milliseconds(fixed(bins[bins.length - 1].toMs))}</span>
      </div>
    </div>
  )
}

function StatusCodes({ codes }) {
  const entries = Object.entries(codes).sort(([first], [second]) => Number(first) - Number(second))
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{LOAD_TEST_TEXT.statusLabel}</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {entries.map(([code, count]) => (
          <Badge key={code} variant={statusVariant({ statusCode: Number(code) })}>{LOAD_TEST_TEXT.statusCount(code, count)}</Badge>
        ))}
      </div>
    </div>
  )
}

function ErrorSamples({ samples }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{LOAD_TEST_TEXT.errorsLabel}</SectionLabel>
      <ul className="flex flex-col gap-1 font-mono text-xs text-destructive">
        {samples.map((sample) => <li key={sample}>{sample}</li>)}
      </ul>
    </div>
  )
}

function Results({ report }) {
  const text = LOAD_TEST_TEXT.summary
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Figure label={text.total} value={formatNumber(report.total)} />
        <Figure label={text.succeeded} value={formatNumber(report.succeeded)} />
        <Figure
          label={text.failed}
          value={formatNumber(report.failed)}
          title={LOAD_TEST_TEXT.failureBreakdown(report.networkErrors, report.statusFailures, report.config.failureStatus)}
        />
        <Figure label={text.rate} value={formatNumber(report.requestsPerSecond)} />
        <Figure label={text.received} value={formatBytes(report.bytesReceived)} />
      </div>
      {report.stopped && <Badge className="self-start" variant="clientError">{LOAD_TEST_TEXT.stopped}</Badge>}
      {report.total > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <SectionLabel>{LOAD_TEST_TEXT.percentilesLabel}</SectionLabel>
            <DataTable columns={percentileColumns()} rows={percentileRows(report.latency)} />
            <p className="text-2xs text-muted-foreground">{LOAD_TEST_TEXT.accuracy(LATENCY_ACCURACY_PERCENT)}</p>
          </div>
          <Histogram bins={report.distribution} />
        </>
      )}
      {Object.keys(report.statusCodes).length > 0 && <StatusCodes codes={report.statusCodes} />}
      {report.errorSamples.length > 0 && <ErrorSamples samples={report.errorSamples} />}
    </div>
  )
}

function Outcome({ load }) {
  if (load.report) return <Results report={load.report} />
  if (load.progress) return <Progress progress={load.progress} />
  return <EmptyState icon={Gauge} title={LOAD_TEST_TEXT.emptyTitle} description={LOAD_TEST_TEXT.emptyHint} />
}

export function LoadTestDialog({ actions }) {
  const load = useLoadTestStore()
  const { request, blocked, failure, isRunning } = load

  return (
    <Dialog label={LOAD_TEST_TEXT.title} size="lg" floating={LOAD_TEST_WINDOW} onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{LOAD_TEST_TEXT.title}</DialogTitle>
        {isRunning && <Badge variant="success">{LOAD_TEST_TEXT.running}</Badge>}
        <MethodTag method={request.method} />
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={request.url}>{request.url}</span>
      </DialogHeader>
      <Notice tone="warning">{LOAD_TEST_TEXT.notice}</Notice>
      {(blocked || failure) && <Notice tone="destructive" role="alert">{blocked || failure}</Notice>}
      <DialogBody className="flex flex-col gap-4">
        <Controls load={load} actions={actions} />
        <Outcome load={load} />
      </DialogBody>
    </Dialog>
  )
}
