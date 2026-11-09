import { Check, ChevronRight } from "lucide-react"

function TranscriptLine({ line }) {
  if (line.kind === "prompt") {
    return (
      <p className="mt-5 flex gap-2 text-foreground first:mt-0">
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        {line.text}
      </p>
    )
  }
  if (line.kind === "tool") {
    return (
      <p className="mt-3 pl-6 text-muted-foreground">
        <span className="text-primary">gostman</span> · {line.tool} <span className="text-foreground/80">{line.target}</span>
      </p>
    )
  }
  if (line.kind === "result") {
    return (
      <p className="mt-1 flex gap-2 pl-6 text-success">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {line.text}
      </p>
    )
  }
  return <p className="mt-1 pl-12 text-muted-foreground">{line.text}</p>
}

export function AgentTranscript({ lines }) {
  return (
    <figure className="landing-frame overflow-hidden bg-background text-left shadow-2xl shadow-black/40">
      <figcaption className="flex h-10 items-center gap-2 border-b border-border/60 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden="true" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">claude · gostman mcp</span>
      </figcaption>
      <div className="p-5 font-mono text-xs leading-relaxed sm:p-6 sm:text-[0.8125rem]">
        {lines.map((line, index) => (
          <TranscriptLine key={index} line={line} />
        ))}
      </div>
    </figure>
  )
}
