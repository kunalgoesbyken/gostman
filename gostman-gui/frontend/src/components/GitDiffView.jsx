import { useMemo } from "react"
import { cn } from "../lib/utils"

const BINARY_NOTICE = "This file is binary, so there is no line diff."
const EMPTY_NOTICE = "No textual changes."
const LINE_TONES = {
  "+": "bg-success/10 text-success",
  "-": "bg-destructive/10 text-destructive",
  "@": "bg-muted text-muted-foreground",
  "\\": "text-muted-foreground",
}

function parseDiff(text) {
  const lines = []
  let inHunk = false
  for (const line of text.split("\n")) {
    if (line.startsWith("@@")) inHunk = true
    if (inHunk && line !== "") lines.push({ marker: line[0], text: line })
  }
  return lines
}

export function GitDiffView({ text, binary, summary }) {
  const lines = useMemo(() => parseDiff(text), [text])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {summary.length > 0 && (
        <ul aria-label="Summary of changes" className="shrink-0 space-y-0.5 border-b border-border px-3 py-2 text-xs">
          {summary.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <div aria-label="Diff" className="min-h-0 flex-1 overflow-auto py-1 font-mono text-xs leading-5">
        {binary && <p className="px-3 text-muted-foreground">{BINARY_NOTICE}</p>}
        {!binary && lines.length === 0 && <p className="px-3 text-muted-foreground">{EMPTY_NOTICE}</p>}
        {lines.map((line, index) => (
          <div key={index} className={cn("whitespace-pre-wrap px-3 [overflow-wrap:anywhere]", LINE_TONES[line.marker])}>{line.text}</div>
        ))}
      </div>
    </div>
  )
}
