import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Dialog, DialogBody, DialogHeader } from "./ui/dialog"
import { SegmentedControl } from "./ui/segmented"
import { MonacoDiff } from "./MonacoEditor"
import { COMPARE_PARTS, describeResponse } from "../lib/responseHistory"

const PART_OPTIONS = Object.entries(COMPARE_PARTS).map(([value, part]) => ({ value, label: part.label }))

export function ResponseCompareDialog({ earlier, latest, onClose }) {
  const [partName, setPartName] = useState(PART_OPTIONS[0].value)
  const part = COMPARE_PARTS[partName]

  return (
    <Dialog label="Compare responses" size="lg" className="max-w-6xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <SegmentedControl label="Compare" options={PART_OPTIONS} value={partName} onChange={setPartName} />
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate font-mono text-xs text-muted-foreground">
          {describeResponse(earlier)}
          <ArrowRight aria-label="compared with" className="h-3.5 w-3.5 shrink-0" />
          {describeResponse(latest)}
        </span>
      </DialogHeader>
      <DialogBody className="min-h-0 flex-1 p-0">
        <MonacoDiff
          original={part.text(earlier.response)}
          modified={part.text(latest.response)}
          language={part.language(latest.response)}
        />
      </DialogBody>
    </Dialog>
  )
}
