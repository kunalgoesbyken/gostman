import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, Lock, LockOpen, X } from "lucide-react"
import { IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { asText } from "../lib/variableScopes"
import { cn } from "../lib/utils"

const COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.5fr)_1.5rem_1.5rem_1.5rem] items-center gap-x-2 px-3"
const BLANK_ROW = { name: "", value: "", secret: false, enabled: true }

const matches = (row, needle) => (
  row.name.toLowerCase().includes(needle) || (!row.secret && asText(row.value).toLowerCase().includes(needle))
)

function ValueField({ row, isRevealed, readOnly, autoFocus, onChange }) {
  const isHidden = row.secret && !isRevealed
  return (
    <Input
      type={isHidden ? "password" : "text"}
      value={asText(row.value)}
      readOnly={readOnly}
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

function Row({ row, isDraft, isRevealed, focusField, features, onChange, onRemove, onToggleReveal }) {
  const canReveal = row.secret
  return (
    <div className={cn(COLUMNS, "h-9 border-b border-border", !row.enabled && "opacity-50")}>
      {features.enabled ? (
        <Checkbox
          label={TEXT.enabled}
          checked={row.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className={cn(isDraft && "invisible")}
        />
      ) : <span />}
      <Input
        value={row.name}
        readOnly={features.readOnly}
        autoFocus={focusField === "name"}
        placeholder={TEXT.variable}
        aria-label={TEXT.variable}
        spellCheck={false}
        onChange={(event) => onChange({ name: event.target.value })}
        className="font-mono"
      />
      <ValueField row={row} isRevealed={isRevealed} readOnly={features.readOnly} autoFocus={focusField === "value"} onChange={onChange} />
      {canReveal ? (
        <IconButton
          label={isRevealed ? TEXT.hide : TEXT.reveal}
          icon={isRevealed ? EyeOff : Eye}
          size="icon-xs"
          onClick={onToggleReveal}
        />
      ) : <span />}
      {features.secret && !isDraft ? (
        <IconButton
          label={row.secret ? TEXT.notSecret : TEXT.secret}
          icon={row.secret ? Lock : LockOpen}
          size="icon-xs"
          aria-pressed={row.secret}
          onClick={() => onChange({ secret: !row.secret })}
          className={row.secret ? "text-primary" : undefined}
        />
      ) : <span />}
      {!features.readOnly && !isDraft ? <IconButton label={TEXT.removeRow} icon={X} size="icon-xs" onClick={onRemove} /> : <span />}
    </div>
  )
}

export function EnvironmentTable({ rows, query, features, onChange }) {
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
      <div className={cn(COLUMNS, "h-7 border-b border-border")}>
        <span />
        <SectionLabel>{TEXT.variable}</SectionLabel>
        <SectionLabel>{TEXT.value}</SectionLabel>
        <span />
        <span />
        <span />
      </div>
      {visible.map(({ row, index }) => (
        <Row
          key={index}
          row={row}
          isRevealed={revealed.has(index)}
          focusField={focus?.index === index ? focus.field : null}
          features={features}
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
          onChange={addRow}
        />
      )}
    </div>
  )
}
