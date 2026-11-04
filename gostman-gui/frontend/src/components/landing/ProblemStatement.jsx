import { cn } from "../../lib/utils"

const LINES = [
  "Requests live in one tool.",
  "Tests live in another, and CI runs a copy of both.",
  "The copy is the one that drifts.",
]

export function ProblemStatement() {
  return (
    <p className="reveal-on-scroll mb-20 max-w-5xl text-3xl font-semibold leading-tight tracking-tight md:text-5xl [text-wrap:balance]">
      {LINES.map((line, index) => (
        <span key={line} className={cn("block", index === LINES.length - 1 && "text-muted-foreground")}>{line}</span>
      ))}
    </p>
  )
}
