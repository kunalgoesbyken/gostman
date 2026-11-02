import { useRef, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { localizedText } from "../lib/localized"
import { SPEC_TEXT } from "../lib/specText"

const SEVERITIES = [
  { key: "breaking", countKey: "breaking", variant: "serverError" },
  { key: "non-breaking", countKey: "nonBreaking", variant: "success" },
  { key: "informational", countKey: "informational", variant: "redirect" },
]

const sourceOf = (side) => {
  if (side.text) return { text: side.text }
  const address = side.address.trim()
  if (address.startsWith("http://") || address.startsWith("https://")) return { url: address }
  return { path: address }
}

const isReady = (side) => side.text !== "" || side.address.trim() !== ""

const placeOf = (change) => [change.method, change.path, change.where].filter(Boolean).join(" ")

function SourceField({ label, side, onChange }) {
  const fileRef = useRef(null)
  const pick = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    onChange({ address: "", text: await file.text(), fileName: file.name })
  }
  return (
    <Field label={label} grouped>
      <div className="flex min-w-0 items-center gap-2">
        {side.text ? (
          <span className="min-w-0 flex-1 truncate text-xs" title={side.fileName}><bdi dir="auto">{SPEC_TEXT.diffFileChosen({ name: side.fileName })}</bdi></span>
        ) : (
          <Input
            aria-label={`${label}: ${SPEC_TEXT.diffAddress}`}
            value={side.address}
            placeholder={SPEC_TEXT.addressPlaceholder}
            onChange={(event) => onChange({ address: event.target.value, text: "", fileName: "" })}
            dir="ltr"
          />
        )}
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{SPEC_TEXT.diffChooseFile}</Button>
        <input ref={fileRef} type="file" accept=".json,.yaml,.yml" onChange={pick} className="hidden" />
      </div>
    </Field>
  )
}

function Result({ report }) {
  if (report.changes.length === 0 && !report.truncated) return <p className="pt-3 text-xs text-muted-foreground">{SPEC_TEXT.diffClean}</p>
  return (
    <div className="pt-3">
      {report.truncated && <p role="alert" className="pb-2 text-xs text-warning">{SPEC_TEXT.diffTruncated}</p>}
      <div className="flex flex-wrap gap-2 pb-2">
        {SEVERITIES.map(({ key, countKey, variant }) => (
          <Badge key={key} variant={variant}>{SPEC_TEXT.diffCount[countKey](report[countKey])}</Badge>
        ))}
      </div>
      <ul>
        {report.changes.map((change, index) => (
          <li key={index} className="flex min-h-7 items-baseline gap-2 py-0.5 text-xs">
            <span className="w-24 shrink-0 text-2xs text-muted-foreground">{change.severity === "breaking" ? SPEC_TEXT.diffBreaking : change.severity === "non-breaking" ? SPEC_TEXT.diffNonBreaking : SPEC_TEXT.diffInformational}</span>
            <span className="min-w-0 flex-1 break-words">
              {placeOf(change) && <bdi dir="ltr" className="font-mono text-2xs text-muted-foreground">{placeOf(change)}: </bdi>}
              <bdi dir="auto">{localizedText(change.localized, change.message)}</bdi>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SpecDiffDialog({ dialog, actions, onClose }) {
  const [oldSide, setOldSide] = useState({ address: "", text: "", fileName: "" })
  const [newSide, setNewSide] = useState({ address: sourceAddress(dialog.newSource), text: "", fileName: "" })
  const [state, setState] = useState({ running: false, report: null, error: "" })

  const run = async () => {
    setState({ running: true, report: null, error: "" })
    try {
      setState({ running: false, report: await actions.diff(sourceOf(oldSide), sourceOf(newSide)), error: "" })
    } catch (error) {
      setState({ running: false, report: null, error: error.message })
    }
  }

  return (
    <Dialog label={SPEC_TEXT.diffTitle} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{SPEC_TEXT.diffTitle}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="pb-3 text-xs text-muted-foreground">{SPEC_TEXT.diffHint}</p>
        <div className="grid gap-2">
          <SourceField label={SPEC_TEXT.diffOld} side={oldSide} onChange={setOldSide} />
          <SourceField label={SPEC_TEXT.diffNew} side={newSide} onChange={setNewSide} />
        </div>
        {state.error && <p role="alert" className="pt-3 text-xs text-destructive">{state.error}</p>}
        {state.report && <Result report={state.report} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{SPEC_TEXT.close}</Button>
        <Button disabled={state.running || !isReady(oldSide) || !isReady(newSide)} onClick={run}>{state.running ? SPEC_TEXT.diffRunning : SPEC_TEXT.diffRun}</Button>
      </DialogFooter>
    </Dialog>
  )
}

function sourceAddress(source) {
  return source?.url || source?.path || ""
}
