import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { SectionLabel } from "./ui/panel"
import { GIT_TEXT as TEXT } from "../lib/gitText"

const joinBoth = (ours, theirs) => (ours === "" || ours.endsWith("\n") ? ours : `${ours}\n`) + theirs

const hasMarkers = (text) => /^<{7} /m.test(text) && /^>{7} /m.test(text)

function Side({ label, content, isGone, onAccept, acceptLabel }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border last:border-r-0">
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <SectionLabel>{label}</SectionLabel>
        <Button size="sm" variant="outline" onClick={onAccept}>{acceptLabel}</Button>
      </div>
      <pre aria-label={label} className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs [overflow-wrap:anywhere]">
        {isGone ? <span className="text-muted-foreground">{TEXT.deletedSide}</span> : content}
      </pre>
    </section>
  )
}

export function ConflictEditor({ conflict, isBusy, onResolve }) {
  const [result, setResult] = useState(conflict.working)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-44 shrink-0 border-b border-border">
        <Side label={TEXT.ours} content={conflict.ours} isGone={conflict.oursGone} acceptLabel={TEXT.acceptOurs} onAccept={() => setResult(conflict.ours)} />
        <Side label={TEXT.theirs} content={conflict.theirs} isGone={conflict.theirsGone} acceptLabel={TEXT.acceptTheirs} onAccept={() => setResult(conflict.theirs)} />
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <SectionLabel>{TEXT.result}</SectionLabel>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setResult(joinBoth(conflict.ours, conflict.theirs))}>{TEXT.acceptBoth}</Button>
          <Button size="sm" variant="outline" onClick={() => setResult(conflict.working)}>{TEXT.reset}</Button>
        </div>
      </div>
      <Textarea
        aria-label={TEXT.result}
        value={result}
        onChange={(event) => setResult(event.target.value)}
        className="min-h-0 flex-1 rounded-none border-0 px-3"
      />
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
        <span className="text-xs text-warning">{hasMarkers(result) ? TEXT.markersLeft : ""}</span>
        <Button size="sm" disabled={isBusy || hasMarkers(result)} onClick={() => onResolve(conflict.path, result)}>
          <Check />
          {TEXT.markResolved}
        </Button>
      </div>
    </div>
  )
}
