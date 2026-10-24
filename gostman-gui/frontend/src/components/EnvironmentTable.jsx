import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, KeyRound, Lock, LockOpen, X } from "lucide-react"
import { IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { BLANK_REFERENCE, ReferenceFields } from "./SecretReferenceFields"
import { useSecretConnections } from "../hooks/useSecretConnections"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { REFERENCE_TEXT } from "../lib/secretsText"
import { asText } from "../lib/variableScopes"
import { cn } from "../lib/utils"

const COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.5fr)_1.5rem_1.5rem_1.5rem] items-center gap-x-2 px-3"
const REFERENCE_COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.5fr)_1.5rem_1.5rem_1.5rem_1.5rem] items-center gap-x-2 px-3"
const BLANK_ROW = { name: "", value: "", secret: false, enabled: true }

const matches = (row, needle) => (
  row.name.toLowerCase().includes(needle) || (!row.secret && asText(row.value).toLowerCase().includes(needle))
)

const isUnnamed = (row) => row.name.trim() === "" && (asText(row.value) !== "" || Boolean(row.ref))

function ReadOnlyText({ text, label }) {
  return (
    <span aria-label={label} title={text} className="flex h-7 min-w-0 items-center font-mono text-xs text-foreground">
      <span className="truncate">{text}</span>
    </span>
  )
}

function NameField({ row, isDraft, features, autoFocus, onChange }) {
  if (features.readOnly) return <ReadOnlyText text={row.name} label={TEXT.variable} />
  const isMissing = !isDraft && isUnnamed(row)
  return (
    <Input
      value={row.name}
      autoFocus={autoFocus}
      placeholder={isMissing ? TEXT.nameRequired : TEXT.variable}
      aria-label={TEXT.variable}
      aria-invalid={isMissing}
      spellCheck={false}
      onChange={(event) => onChange({ name: event.target.value })}
      className={cn("font-mono", isMissing && "border-warning placeholder:text-warning")}
    />
  )
}

function ValueField({ row, isRevealed, readOnly, autoFocus, onChange }) {
  const isHidden = row.secret && !isRevealed
  if (readOnly) return <ReadOnlyText text={isHidden ? TEXT.hiddenValue : asText(row.value)} label={TEXT.value} />
  return (
    <Input
      type={isHidden ? "password" : "text"}
      value={asText(row.value)}
      autoFocus={autoFocus}
      placeholder={TEXT.value}
      aria-label={TEXT.value}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      className="font-mono"
    />
  )
}

function ReferenceSummary({ reference }) {
  const target = reference.path ? `${reference.provider}: ${reference.path}` : REFERENCE_TEXT.manager
  return (
    <span title={target} className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground">
      <KeyRound className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-mono">{target}</span>
    </span>
  )
}

function RowCells({ row, isDraft, isRevealed, focusField, features, references, onChange, onRemove, onToggleReveal }) {
  const canReveal = row.secret
  const toggleReference = () => onChange(row.ref ? { ref: undefined } : { ref: { ...BLANK_REFERENCE, provider: references.connections[0]?.alias ?? "" }, value: "", secret: false })
  return (
    <div className={cn(references ? REFERENCE_COLUMNS : COLUMNS, "h-9")}>
      {features.enabled ? (
        <Checkbox
          label={TEXT.enabled}
          checked={row.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className={cn(isDraft && "invisible")}
        />
      ) : <span />}
      <NameField row={row} isDraft={isDraft} features={features} autoFocus={focusField === "name"} onChange={onChange} />
      {row.ref ? <ReferenceSummary reference={row.ref} /> : <ValueField row={row} isRevealed={isRevealed} readOnly={features.readOnly} autoFocus={focusField === "value"} onChange={onChange} />}
      {canReveal ? (
        <IconButton
          label={isRevealed ? TEXT.hide : TEXT.reveal}
          icon={isRevealed ? EyeOff : Eye}
          size="icon-xs"
          onClick={onToggleReveal}
        />
      ) : <span />}
      {features.secret && !isDraft && !row.ref ? (
        <IconButton
          label={row.secret ? TEXT.notSecret : TEXT.secret}
          icon={row.secret ? Lock : LockOpen}
          size="icon-xs"
          aria-pressed={row.secret}
          onClick={() => onChange({ secret: !row.secret })}
          className={row.secret ? "text-primary" : undefined}
        />
      ) : <span />}
      {references && (!isDraft ? (
        <IconButton
          label={row.ref ? REFERENCE_TEXT.usePlain : REFERENCE_TEXT.useManager}
          icon={KeyRound}
          size="icon-xs"
          aria-pressed={Boolean(row.ref)}
          onClick={toggleReference}
          className={row.ref ? "text-primary" : undefined}
        />
      ) : <span />)}
      {!features.readOnly && !isDraft ? <IconButton label={TEXT.removeRow} icon={X} size="icon-xs" onClick={onRemove} /> : <span />}
    </div>
  )
}

function Row(props) {
  const { row, references, onChange } = props
  return (
    <div className={cn("border-b border-border", !row.enabled && "opacity-50")}>
      <RowCells {...props} />
      {row.ref && references && <ReferenceFields reference={row.ref} {...references} onChange={(ref) => onChange({ ref })} />}
    </div>
  )
}

export function EnvironmentTable({ rows, query, features, secrets, onChange }) {
  const { connections, kinds, isLoaded } = useSecretConnections(secrets)
  const references = secrets && features.references ? { secrets, connections, kinds, isLoaded } : null
  const [revealed, setRevealed] = useState(() => new Set())
  const [focus, setFocus] = useState(null)
  const needle = query.trim().toLowerCase()
  const visible = useMemo(
    () => rows.map((row, index) => ({ row, index })).filter(({ row }) => !needle || matches(row, needle)),
    [rows, needle]
  )

  useEffect(() => {
    if (focus) setFocus(null)
  }, [focus])

  const addRow = (patch) => {
    setFocus({ index: rows.length, field: Object.keys(patch)[0] })
    onChange([...rows, { ...BLANK_ROW, ...patch }])
  }

  const edit = (index, patch) => onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const toggleReveal = (index) => setRevealed((current) => {
    const next = new Set(current)
    if (!next.delete(index)) next.add(index)
    return next
  })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {!features.readOnly && rows.some(isUnnamed) && <Notice tone="warning" role="status">{TEXT.unnamedRows}</Notice>}
      <div className={cn(references ? REFERENCE_COLUMNS : COLUMNS, "h-7 border-b border-border")}>
        <span />
        <SectionLabel>{TEXT.variable}</SectionLabel>
        <SectionLabel>{TEXT.value}</SectionLabel>
        <span />
        <span />
        <span />
        {references && <span />}
      </div>
      {visible.map(({ row, index }) => (
        <Row
          key={index}
          row={row}
          isRevealed={revealed.has(index)}
          focusField={focus?.index === index ? focus.field : null}
          features={features}
          references={references}
          onChange={(patch) => edit(index, patch)}
          onRemove={() => onChange(rows.filter((_, at) => at !== index))}
          onToggleReveal={() => toggleReveal(index)}
        />
      ))}
      {!features.readOnly && (
        <Row
          isDraft
          row={BLANK_ROW}
          features={features}
          references={references}
          onChange={addRow}
        />
      )}
    </div>
  )
}
