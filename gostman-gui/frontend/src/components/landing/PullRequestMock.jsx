import { BrandIcon } from "../ui/brandIcon"
import { MockFrame, lineStyle } from "./MockFrame"
import { Method, ResultDot, StatusPill } from "./mockParts"

const CHECKS = [
  { name: "Gostman run / orders-api", tone: "fail", result: "1 failed" },
  { name: "Build / test", tone: "pass", result: "passed" },
]

const COUNTS = [
  { label: "Requests", passed: 3, failed: 1 },
  { label: "Checks", passed: 6, failed: 1 },
]

export function PullRequestMock({ isPlaying }) {
  return (
    <MockFrame title="#482 Add the export endpoint" label="A pull request with a failing Gostman check and the comment the GitHub Action keeps up to date" isPlaying={isPlaying}>
      <ul className="divide-y divide-border/40 border-b border-border/60 px-4 text-sm">
        {CHECKS.map((check, index) => (
          <li key={check.name} style={lineStyle(index)} className="mock-line flex items-center gap-3 py-3">
            <ResultDot tone={check.tone} />
            <span className="min-w-0 flex-1 truncate text-foreground">{check.name}</span>
            <StatusPill tone={check.tone}>{check.result}</StatusPill>
          </li>
        ))}
      </ul>
      <div className="flex-1 space-y-4 p-4">
        <p style={lineStyle(CHECKS.length)} className="mock-line flex items-center gap-2 text-xs text-muted-foreground">
          <BrandIcon brand="github-actions" />
          github-actions commented
        </p>
        <dl style={lineStyle(CHECKS.length + 1)} className="mock-line grid grid-cols-[auto_auto_auto] justify-start gap-x-6 gap-y-2 font-mono text-xs">
          {COUNTS.map((count) => (
            <div key={count.label} className="contents">
              <dt className="text-muted-foreground">{count.label}</dt>
              <dd className="text-success">{count.passed} passed</dd>
              <dd className="text-destructive">{count.failed} failed</dd>
            </div>
          ))}
        </dl>
        <p style={lineStyle(CHECKS.length + 2)} className="mock-line flex items-center gap-3 font-mono text-xs">
          <Method method="GET" />
          <span className="min-w-0 truncate text-foreground">Items/Export items</span>
          <StatusPill tone="fail">500</StatusPill>
        </p>
      </div>
    </MockFrame>
  )
}
