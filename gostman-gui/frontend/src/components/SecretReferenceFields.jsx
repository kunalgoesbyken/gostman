import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { ConnectionMark } from "./ConnectionMark"
import { connectionColor } from "../lib/secretOrigins"
import { REFERENCE_TEXT as TEXT } from "../lib/secretsText"
import { cn } from "../lib/utils"

export const BLANK_REFERENCE = { provider: "", path: "", field: "", version: "" }

const TARGET_COLUMNS = "grid items-center gap-2"
const VERSIONED_COLUMNS = "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.75fr)_auto]"
const UNVERSIONED_COLUMNS = "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"

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
  const kindName = kind?.name
  const showsVersion = kind?.versions !== false || reference.version !== ""
  const fieldName = TEXT.fieldNames[kindName] || TEXT.field
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
      <div className={cn(TARGET_COLUMNS, showsVersion ? VERSIONED_COLUMNS : UNVERSIONED_COLUMNS)}>
        <Input
          value={reference.path}
          placeholder={TEXT.paths[kindName] || TEXT.path}
          aria-label={TEXT.path}
          spellCheck={false}
          onChange={(event) => edit({ path: event.target.value })}
          className="font-mono"
        />
        <Input
          value={reference.field}
          placeholder={TEXT.fieldPlaceholders[kindName] || TEXT.fieldPlaceholder}
          aria-label={fieldName}
          title={fieldName}
          spellCheck={false}
          onChange={(event) => edit({ field: event.target.value })}
          className="font-mono"
        />
        {showsVersion && (
          <Input
            value={reference.version}
            placeholder={TEXT.versions[kindName] || TEXT.version}
            aria-label={TEXT.version}
            title={TEXT.versions[kindName] || TEXT.version}
            spellCheck={false}
            onChange={(event) => edit({ version: event.target.value })}
            className="font-mono"
          />
        )}
        <Button variant="outline" size="sm" disabled={isTesting || reference.provider === "" || reference.path.trim() === ""} onClick={test}>
          {isTesting ? TEXT.testing : TEXT.test}
        </Button>
      </div>
      <TestResult outcome={outcome} />
    </div>
  )
}

export function ReferenceFields({ reference: stored, connections, kinds, isLoaded, secrets, onChange }) {
  const reference = { ...BLANK_REFERENCE, ...stored }
  const connection = connections.find((candidate) => candidate.alias === reference.provider)
  const kind = kinds.find((candidate) => candidate.name === connection?.kind)
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
          {connections.map((candidate) => (
            <option key={candidate.alias} value={candidate.alias} icon={<ConnectionMark kind={candidate.kind} color={connectionColor(candidate)} />}>
              {candidate.disabled ? TEXT.offOption(candidate.alias) : candidate.alias}
            </option>
          ))}
        </Select>
        <ReferenceTarget reference={reference} kind={kind} secrets={secrets} onChange={onChange} />
      </div>
      {isUnknown && <p role="alert" className="text-xs text-warning">{TEXT.unknownConnection(reference.provider)}</p>}
      {connection?.disabled && <p className="text-xs text-muted-foreground">{TEXT.connectionOff(connection.alias)}</p>}
      {isLoaded && connections.length === 0 && !isUnknown && <p className="text-xs text-muted-foreground">{TEXT.noConnections}</p>}
    </div>
  )
}
