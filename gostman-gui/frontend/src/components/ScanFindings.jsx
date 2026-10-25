import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { localizedText } from "../lib/localized"
import { SCAN_TEXT } from "../lib/scanText"

const SEVERITY_VARIANTS = { high: "serverError", medium: "clientError" }

function Finding({ finding, onGoToRequest }) {
  const { location } = finding
  const canOpen = location.kind === "request" && location.requestId && onGoToRequest
  return (
    <li className="flex items-start gap-3 border-b border-border px-3 py-2 text-xs">
      <Badge variant={SEVERITY_VARIANTS[finding.severity]} className="mt-0.5 w-14 justify-center">
        {SCAN_TEXT.severity[finding.severity]}
      </Badge>
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="text-foreground">
          <span className="text-muted-foreground">{SCAN_TEXT.kinds[location.kind]}: </span>
          {location.path}
        </p>
        <p className="text-muted-foreground">{location.field}</p>
        <p className="text-muted-foreground">
          <span className="font-mono text-foreground">{finding.preview}</span>
          {" "}{localizedText(finding.localized, finding.reason)} ({finding.rule})
        </p>
      </div>
      {canOpen && (
        <Button variant="outline" size="sm" onClick={() => onGoToRequest(location.requestId)}>
          {SCAN_TEXT.goToRequest}
        </Button>
      )}
    </li>
  )
}

export function ScanFindings({ findings, onGoToRequest, className }) {
  return (
    <ul aria-label={SCAN_TEXT.findings} className={className}>
      {findings.map((finding) => (
        <Finding
          key={`${finding.location.kind}/${finding.location.path}/${finding.location.field}/${finding.rule}/${finding.fingerprint}`}
          finding={finding}
          onGoToRequest={onGoToRequest}
        />
      ))}
    </ul>
  )
}
