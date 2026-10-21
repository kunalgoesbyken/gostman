import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { REFERENCE_TEXT as TEXT } from "../lib/secretsText"
import { cn } from "../lib/utils"

export const BLANK_REFERENCE = { provider: "", path: "", field: "", version: "" }

const TARGET_COLUMNS = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.75fr)_auto] items-center gap-2"

function TestResult({ outcome }) {
  if (!outcome) return null
  return (
    <p role={outcome.isOk ? "status" : "alert"} className={cn("text-xs [overflow-wrap:anywhere]", outcome.isOk ? "text-success" : "text-destructive")}>
      {outcome.text}
    </p>
  )
}

export function ReferenceTarget({ reference: stored, kind, secrets, onChange }) {
  const reference = { ...BLANK_REFERENCE, ...stored }
  const [outcome, setOutcome] = useState(null)
  const [isTesting, setIsTesting] = useState(false)
  const edit = (patch) => {
    setOutcome(null)
    onChange({ ...reference, ...patch })
  }

  const test = async () => {
    setIsTesting(true)
    try {
      setOutcome({ isOk: true, text: TEXT.worked(await secrets.test(reference)) })
    } catch (error) {
      setOutcome({ isOk: false, text: error.message })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={TARGET_COLUMNS}>
        <Input
          value={reference.path}
          placeholder={TEXT.paths[kind] || TEXT.path}
          aria-label={TEXT.path}
          spellCheck={false}
          onChange={(event) => edit({ path: event.target.value })}
          className="font-mono"
        />
        <Input
          value={reference.field}
          placeholder={TEXT.fieldPlaceholder}
          aria-label={TEXT.field}
          title={TEXT.field}
          spellCheck={false}
          onChange={(event) => edit({ field: event.target.value })}
          className="font-mono"
        />
        <Input
          value={reference.version}
          placeholder={TEXT.versions[kind] || TEXT.version}
          aria-label={TEXT.version}
          title={TEXT.versions[kind] || TEXT.version}
          spellCheck={false}
          onChange={(event) => edit({ version: event.target.value })}
          className="font-mono"
        />
        <Button variant="outline" size="sm" disabled={isTesting || reference.provider === "" || reference.path.trim() === ""} onClick={test}>
          {isTesting ? TEXT.testing : TEXT.test}
        </Button>
      </div>
      <TestResult outcome={outcome} />
    </div>
  )
}

export function ReferenceFields({ reference: stored, connections, isLoaded, secrets, onChange }) {
  const reference = { ...BLANK_REFERENCE, ...stored }
  const connection = connections.find((candidate) => candidate.alias === reference.provider)
  const isUnknown = isLoaded && reference.provider !== "" && !connection
  return (
    <div className="flex flex-col gap-1 pb-2 pl-10 pr-3">
      <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-2">
        <Select
          value={reference.provider}
          aria-label={TEXT.connection}
          onChange={(event) => onChange({ ...reference, provider: event.target.value })}
        >
          <option value="" disabled>{TEXT.noConnection}</option>
          {isUnknown && <option value={reference.provider}>{reference.provider}</option>}
          {connections.map((candidate) => <option key={candidate.alias} value={candidate.alias}>{candidate.alias}</option>)}
        </Select>
        <ReferenceTarget reference={reference} kind={connection?.kind} secrets={secrets} onChange={onChange} />
      </div>
      {isUnknown && <p role="alert" className="text-xs text-warning">{TEXT.unknownConnection(reference.provider)}</p>}
      {isLoaded && connections.length === 0 && !isUnknown && <p className="text-xs text-muted-foreground">{TEXT.noConnections}</p>}
    </div>
  )
}
