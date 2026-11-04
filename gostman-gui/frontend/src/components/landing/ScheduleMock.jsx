import { cn } from "../../lib/utils"
import { MockFrame, lineStyle } from "./MockFrame"
import { ResultDot } from "./mockParts"

const RUN_COUNT = 36
const FAILED_RUNS = new Set([22, 23])
const TIME_MARKS = ["09:00", "10:30", "11:55"]

const RUNS = Array.from({ length: RUN_COUNT }, (_, index) => ({
  tone: FAILED_RUNS.has(index) ? "fail" : "pass",
  height: FAILED_RUNS.has(index) ? 100 : 35 + ((index * 37) % 40),
}))

const ALERTS = [
  { tone: "fail", text: "orders-api started failing", time: "10:50" },
  { tone: "pass", text: "orders-api passes again", time: "11:00" },
]

export function ScheduleMock({ isPlaying }) {
  return (
    <MockFrame title="orders-api · Production · every 5m" label="A run every five minutes against production, with two failed runs and the alerts they sent" isPlaying={isPlaying}>
      <div className="flex flex-1 flex-col p-4">
        <div aria-hidden="true" className="flex min-h-28 flex-1 items-end gap-[3px]">
          {RUNS.map((run, index) => (
            <span
              key={index}
              style={{ ...lineStyle(index / 3), height: `${run.height}%` }}
              className={cn("mock-line flex-1 rounded-sm", run.tone === "fail" ? "bg-destructive" : "bg-success/50")}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 flex justify-between font-mono text-[0.6875rem] text-muted-foreground/70">
          {TIME_MARKS.map((mark) => <span key={mark}>{mark}</span>)}
        </div>
      </div>
      <ul className="divide-y divide-border/40 border-t border-border/60 px-4 font-mono text-xs">
        {ALERTS.map((alert, index) => (
          <li key={alert.text} style={lineStyle(RUN_COUNT / 3 + index)} className="mock-line flex items-center gap-3 py-3">
            <ResultDot tone={alert.tone} />
            <span className="text-muted-foreground">Alert</span>
            <span className="min-w-0 flex-1 truncate text-foreground">{alert.text}</span>
            <span className="text-muted-foreground">{alert.time}</span>
          </li>
        ))}
      </ul>
    </MockFrame>
  )
}
