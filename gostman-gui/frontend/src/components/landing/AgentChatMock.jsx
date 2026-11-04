import { BrandIcon } from "../ui/brandIcon"
import { MockFrame, lineStyle } from "./MockFrame"
import { ResultDot, StatusPill } from "./mockParts"

const TOOL_CALLS = [
  { tool: "send_request", target: "Auth/Sign in", tone: "pass", result: "200" },
  { tool: "send_request", target: "Account/Current user", tone: "pass", result: "200" },
  { tool: "run_folder", target: "Items", tone: "fail", result: "1 of 2 failed" },
]

const ASK = "Sign in, then run the Items folder."
const REPLY = "Export items fails with a 500. The password and cookies stayed redacted."

export function AgentChatMock() {
  return (
    <MockFrame
      header={
        <span className="inline-flex items-center gap-2">
          <BrandIcon brand="claude" />
          Claude Code
        </span>
      }
      label="A coding agent calling Gostman tools over MCP and summarising the result"
    >
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <p style={lineStyle(0)} className="mock-line self-end rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground">{ASK}</p>
        <ul className="space-y-2.5 font-mono text-xs">
          {TOOL_CALLS.map((call, index) => (
            <li key={call.target} style={lineStyle(index + 1)} className="mock-line flex items-center gap-2.5">
              <ResultDot tone={call.tone} />
              <span className="w-28 shrink-0 text-muted-foreground">{call.tool}</span>
              <span className="min-w-0 truncate text-foreground">{call.target}</span>
              <span className="ms-auto">
                <StatusPill tone={call.tone}>{call.result}</StatusPill>
              </span>
            </li>
          ))}
        </ul>
        <p style={lineStyle(TOOL_CALLS.length + 1)} className="mock-line text-sm leading-relaxed text-foreground">{REPLY}</p>
      </div>
    </MockFrame>
  )
}
