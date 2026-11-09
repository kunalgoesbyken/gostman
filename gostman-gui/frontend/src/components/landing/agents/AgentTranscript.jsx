import { Check, Wrench } from "lucide-react"
import { MockFrame } from "../MockFrame"

function ToolCall({ turn }) {
  return (
    <div className="overflow-hidden rounded-md border border-border/60 font-mono text-xs">
      <p className="flex min-w-0 items-center gap-2 border-b border-border/50 bg-muted/20 px-3 py-2">
        <Wrench className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="shrink-0 text-foreground">{turn.tool}</span>
        <span className="min-w-0 truncate text-muted-foreground">{turn.target}</span>
      </p>
      <div className="space-y-1 px-3 py-2.5">
        <p className="flex gap-2 text-success">
          <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {turn.result}
        </p>
        {turn.detail ? <p className="break-words pl-[1.375rem] text-muted-foreground">{turn.detail}</p> : null}
      </div>
    </div>
  )
}

export function AgentTranscript({ title, turns }) {
  return (
    <MockFrame title={title} label={title} className="text-left shadow-2xl shadow-black/40">
      <ol className="space-y-6 p-4 sm:p-6">
        {turns.map((turn) => (
          <li key={turn.prompt} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-muted/50 px-3.5 py-2 text-sm leading-relaxed text-foreground">{turn.prompt}</p>
            <ToolCall turn={turn} />
          </li>
        ))}
      </ol>
    </MockFrame>
  )
}
