import { useMemo, useState } from "react"
import { SegmentedControl } from "./ui/segmented"
import { FieldDiff, useFieldChanges } from "./FieldDiff"
import { GIT_TEXT as TEXT } from "../lib/gitText"
import { unifiedLines } from "../lib/lineDiff"
import { cn } from "../lib/utils"

const LINE_TONES = {
  "+": "bg-success/10 text-success",
  "-": "bg-destructive/10 text-destructive",
  "@": "bg-muted text-muted-foreground",
  "\\": "text-muted-foreground",
}

const VIEW_FIELDS = "fields"
const VIEW_LINES = "lines"

const isYamlPath = (path) => /\.ya?ml$/i.test(path ?? "")

function parseDiff(text) {
  const lines = []
  let inHunk = false
  for (const line of text.split("\n")) {
    if (line.startsWith("@@")) inHunk = true
    if (inHunk && line !== "") lines.push({ marker: line[0], text: line })
  }
  return lines
}

function viewOptions() {
  return [
    { value: VIEW_FIELDS, label: TEXT.viewFields },
    { value: VIEW_LINES, label: TEXT.viewLines },
  ]
}

export function GitDiffView({ text, binary, summary, path, before, after, compared = false }) {
  const [view, setView] = useState(VIEW_FIELDS)
  const hasSides = isYamlPath(path) && typeof before === "string" && typeof after === "string" && !binary
  const changes = useFieldChanges(hasSides ? before : "", hasSides ? after : "")
  const showFields = hasSides && changes !== null && view === VIEW_FIELDS
  const lines = useMemo(() => (compared ? unifiedLines(before, after) : parseDiff(text)), [compared, before, after, text])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {summary.length > 0 && (
        <ul aria-label={TEXT.summaryLabel} className="shrink-0 space-y-0.5 border-b border-border px-3 py-2 text-xs">
          {summary.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      {hasSides && changes !== null && (
        <div className="flex shrink-0 items-center border-b border-border px-3 py-1.5">
          <SegmentedControl label={TEXT.diffViewLabel} options={viewOptions()} value={view} onChange={setView} />
        </div>
      )}
      {showFields && <div className="min-h-0 flex-1 overflow-auto"><FieldDiff changes={changes} /></div>}
      {!showFields && (
        <div dir="ltr" aria-label={TEXT.diffLabel} className="min-h-0 flex-1 overflow-auto py-1 font-mono text-xs leading-5">
          {binary && <p className="px-3 text-muted-foreground">{TEXT.binaryDiff}</p>}
          {!binary && lines.length === 0 && <p className="px-3 text-muted-foreground">{TEXT.noTextChanges}</p>}
          {lines.map((line, index) => (
            <div key={index} className={cn("whitespace-pre-wrap px-3 [overflow-wrap:anywhere]", LINE_TONES[line.marker])}>{line.text}</div>
          ))}
        </div>
      )}
    </div>
  )
}
