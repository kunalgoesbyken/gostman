import { MockFrame, lineStyle } from "./MockFrame"
import { Method, ResultDot } from "./mockParts"

const RESULTS = [
  { method: "POST", name: "Auth/Sign in", status: "200", time: "88 ms", tone: "pass" },
  { method: "GET", name: "Account/Current user", status: "200", time: "46 ms", tone: "pass" },
  { method: "GET", name: "Items/List items", status: "200", time: "46 ms", tone: "pass" },
  { method: "GET", name: "Items/Export items", status: "500", time: "91 ms", tone: "fail" },
]

const countOf = (tone) => RESULTS.filter((result) => result.tone === tone).length

export function RunResultsMock({ isPlaying }) {
  return (
    <MockFrame title="gostman run orders-api" label="Four requests run from the command line, three passing and one failing" isPlaying={isPlaying}>
      <ul className="divide-y divide-border/40 px-4 font-mono text-xs sm:text-[0.8125rem]">
        {RESULTS.map((result, index) => (
          <li key={result.name} style={lineStyle(index)} className="mock-line flex items-center gap-3 py-3">
            <ResultDot tone={result.tone} />
            <Method method={result.method} />
            <span className="min-w-0 flex-1 truncate text-foreground">{result.name}</span>
            <span className={result.tone === "fail" ? "text-destructive" : "text-muted-foreground"}>{result.status}</span>
            <span className="w-14 text-end text-muted-foreground">{result.time}</span>
          </li>
        ))}
      </ul>
      <p style={lineStyle(RESULTS.length)} className="mock-line mt-auto flex gap-4 border-t border-border/60 px-4 py-3 font-mono text-xs text-muted-foreground">
        <span className="text-success">{countOf("pass")} passed</span>
        <span className="text-destructive">{countOf("fail")} failed</span>
        <span className="ms-auto">exit 1</span>
      </p>
    </MockFrame>
  )
}
