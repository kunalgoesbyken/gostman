import { useMemo } from "react"
import { GIT_TEXT as TEXT } from "../lib/gitText"
import { fieldChanges } from "../lib/requestDiff"
import { cn } from "../lib/utils"

const LINE_TONES = {
  "+": "bg-success/10 text-success",
  "-": "bg-destructive/10 text-destructive",
  "@": "text-muted-foreground",
}

const STATUS_TONES = {
  added: "text-success",
  removed: "text-destructive",
  changed: "text-warning",
}

const labelOf = (key) => TEXT.fields[key] ?? key

export function useFieldChanges(before, after) {
  return useMemo(() => fieldChanges(before, after), [before, after])
}

export function FieldDiff({ changes }) {
  if (changes.length === 0) return <p className="px-3 py-2 text-xs text-muted-foreground">{TEXT.noFieldChanges}</p>
  return (
    <div className="space-y-3 px-3 py-2">
      {changes.map((change) => (
        <section key={change.key} aria-label={labelOf(change.key)}>
          <h3 className="flex items-baseline gap-2 text-xs font-medium">
            <span>{labelOf(change.key)}</span>
            <span className={cn("font-normal", STATUS_TONES[change.status])}>{TEXT.fieldStatus[change.status]}</span>
          </h3>
          <div dir="ltr" className="mt-1 overflow-hidden rounded-md border border-border font-mono text-xs leading-5">
            {change.lines.map((line, index) => (
              <div key={index} className={cn("flex gap-2 whitespace-pre-wrap px-2 [overflow-wrap:anywhere]", LINE_TONES[line.marker])}>
                <span aria-hidden className="w-2 shrink-0 select-none">{line.marker === "@" ? "" : line.marker}</span>
                <span className="min-w-0 flex-1">{line.text}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
