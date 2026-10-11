import { cn } from "../../lib/utils"

const LINE_TONES = {
  command: "text-foreground",
  muted: "text-muted-foreground/70",
  pass: "text-success",
  fail: "text-destructive",
  key: "text-syntax-key",
}

export function TerminalBlock({ title, lines, label }) {
  return (
    <figure aria-label={label} className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <figcaption className="border-b border-border/60 px-4 py-2 font-mono text-xs text-muted-foreground">{title}</figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted-foreground">
        {lines.map((line, index) => (
          <span key={index} className={cn("block min-h-[1.25em] whitespace-pre-wrap", LINE_TONES[line.tone])}>{line.text}</span>
        ))}
      </pre>
    </figure>
  )
}
