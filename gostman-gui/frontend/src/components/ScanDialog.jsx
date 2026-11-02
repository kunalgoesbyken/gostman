import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { ScanFindings } from "./ScanFindings"
import { Checkbox } from "./ui/checkbox"
import { toolWindow } from "../lib/dialogWindows"
import { Dialog } from "./ui/dialog"
import { ToolDialogHeader } from "./ToolDialogHeader"
import { FeatureEmpty } from "./FeatureEmpty"
import { TabCount } from "./ui/tabs"
import { useSecretScan } from "../hooks/useSecretScan"
import { SCAN_TEXT } from "../lib/scanText"

const SCAN_WINDOW = toolWindow("scan")

function ScanResult({ state, onGoToRequest }) {
  if (state.isScanning) return <p role="status" className="p-4 text-xs text-muted-foreground">{SCAN_TEXT.scanning}</p>
  if (state.error) return <p role="alert" className="p-4 text-xs text-destructive [overflow-wrap:anywhere]">{SCAN_TEXT.failed(state.error)}</p>
  if (state.report.findings.length === 0) {
    return <FeatureEmpty surface="scan" icon={ShieldCheck} title={SCAN_TEXT.clean} description={SCAN_TEXT.cleanDescription} />
  }
  return <ScanFindings findings={state.report.findings} onGoToRequest={onGoToRequest} />
}

export function ScanDialog({ scan, collection, onGoToRequest, onClose }) {
  const [includeExamples, setIncludeExamples] = useState(true)
  const state = useSecretScan(scan, collection, !includeExamples)
  const count = state.report?.findings.length ?? 0

  return (
    <Dialog label={SCAN_TEXT.title} size="lg" floating={SCAN_WINDOW} onClose={onClose}>
      <ToolDialogHeader featureId="scan" onClose={onClose}>
        <TabCount>{count}</TabCount>
      </ToolDialogHeader>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 pb-2 pt-3">
        <p className="text-xs text-muted-foreground">{SCAN_TEXT.intro}</p>
        <Checkbox checked={includeExamples} onChange={(event) => setIncludeExamples(event.target.checked)} className="h-7 justify-start self-start">
          {SCAN_TEXT.includeExamples}
        </Checkbox>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ScanResult state={state} onGoToRequest={onGoToRequest} />
      </div>
    </Dialog>
  )
}
