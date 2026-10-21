export const LINT_SEVERITIES = ['error', 'warning', 'info']

export function groupFindings(findings, hidden) {
  return LINT_SEVERITIES
    .filter((severity) => !hidden.has(severity))
    .flatMap((severity) => {
      const matching = findings.filter((finding) => finding.severity === severity)
      if (matching.length === 0) return []
      const heading = { kind: 'heading', key: `heading:${severity}`, severity, count: matching.length }
      return [heading, ...matching.map((finding, index) => ({ kind: 'finding', key: `${severity}:${index}`, finding }))]
    })
}
