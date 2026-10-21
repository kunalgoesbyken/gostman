import { useMemo, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { EmptyState } from "./ui/emptyState"
import { VirtualList } from "./ui/VirtualList"
import { SPEC_TEXT } from "../lib/specText"
import { LINT_SEVERITIES, groupFindings } from "../lib/lintFindings"
import { cn } from "../lib/utils"

const ROW_HEIGHT_PX = 52
const BADGE_VARIANTS = { error: "serverError", warning: "clientError", info: "redirect" }

function SeverityFilter({ severity, count, isShown, onToggle }) {
  return (
    <button
      type="button"
      aria-pressed={isShown}
      onClick={() => onToggle(severity)}
      className={cn("rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", !isShown && "opacity-50")}
    >
      <Badge variant={BADGE_VARIANTS[severity]}>{SPEC_TEXT.lintCount[severity](count)}</Badge>
    </button>
  )
}

function FindingBody({ finding }) {
  return (
    <>
      <span className="block truncate text-xs text-foreground">{finding.message}</span>
      <span className="block truncate font-mono text-[11px] text-muted-foreground">{finding.rule} · {finding.operation || finding.path}</span>
    </>
  )
}

function FindingRow({ row, onOpenOperation }) {
  if (row.kind === "heading") {
    return (
      <div style={{ height: ROW_HEIGHT_PX }} className="flex items-end px-4 pb-1 text-xs font-semibold text-foreground">
        {SPEC_TEXT.lintHeading[row.severity](row.count)}
      </div>
    )
  }
  const { finding } = row
  const className = "block w-full px-4 py-1.5 text-left"
  const style = { height: ROW_HEIGHT_PX }
  if (!finding.operation) {
    return <div style={style} title={finding.path} className={className}><FindingBody finding={finding} /></div>
  }
  return (
    <button type="button" style={style} title={finding.path} onClick={() => onOpenOperation(finding.operation)} className={cn(className, "hover:bg-accent")}>
      <FindingBody finding={finding} />
    </button>
  )
}

export function SpecLint({ report, onOpenOperation }) {
  const [hidden, setHidden] = useState(() => new Set())
  const rows = useMemo(() => groupFindings(report.findings, hidden), [report, hidden])

  const toggle = (severity) => setHidden((current) => {
    const next = new Set(current)
    if (!next.delete(severity)) next.add(severity)
    return next
  })

  if (report.findings.length === 0) return <EmptyState icon={CheckCircle2} title={SPEC_TEXT.lintClean} />

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        {LINT_SEVERITIES.map((severity) => (
          <SeverityFilter key={severity} severity={severity} count={report.counts[severity]} isShown={!hidden.has(severity)} onToggle={toggle} />
        ))}
      </div>
      <VirtualList
        items={rows}
        rowHeight={ROW_HEIGHT_PX}
        renderRow={(row) => <FindingRow key={row.key} row={row} onOpenOperation={onOpenOperation} />}
        className="min-h-0 flex-1 py-1"
      />
    </div>
  )
}
