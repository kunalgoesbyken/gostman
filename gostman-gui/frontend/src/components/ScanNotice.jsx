import { useState } from "react"
import { ScanFindings } from "./ScanFindings"
import { Button } from "./ui/button"
import { SCAN_TEXT } from "../lib/scanText"

export function ScanNotice({ state, advice, onGoToRequest, children }) {
  const [isOpen, setIsOpen] = useState(false)
  if (state.error) {
    return <p role="status" className="shrink-0 text-xs text-warning [overflow-wrap:anywhere]">{SCAN_TEXT.failed(state.error)}</p>
  }
  const findings = state.report?.findings ?? []
  if (findings.length === 0) return null

  return (
    <div role="alert" className="flex shrink-0 flex-col gap-2 rounded-md border border-warning/40 p-3 text-xs">
      <p className="font-medium text-foreground">{SCAN_TEXT.found(findings.length)}</p>
      <p className="text-muted-foreground">{advice}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? SCAN_TEXT.hideFindings : SCAN_TEXT.showFindings}
        </Button>
        {children}
      </div>
      {isOpen && <ScanFindings findings={findings} onGoToRequest={onGoToRequest} className="max-h-48 overflow-y-auto rounded-md border border-border" />}
    </div>
  )
}
