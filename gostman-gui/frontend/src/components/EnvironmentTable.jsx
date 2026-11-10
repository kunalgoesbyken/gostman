import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeOff, KeyRound, Lock, LockOpen, Maximize2, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { InfoTip } from "./ui/infoTip"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { DialogPending } from "./ui/dialog"
import { Notice, SectionLabel } from "./ui/panel"
import { BLANK_REFERENCE, ReferenceFields } from "./SecretReferenceFields"
import { useSecretConnections } from "../hooks/useSecretConnections"
import { looksLikeCredential } from "../lib/credentialLook"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { REFERENCE_TEXT } from "../lib/secretsText"
import { asText } from "../lib/variableScopes"
import { cn } from "../lib/utils"

const VariableValueDialog = lazy(() => import("./VariableValueDialog").then((module) => ({ default: module.VariableValueDialog })))

const COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.5fr)_1.5rem_1.5rem_1.5rem] items-center gap-x-2 px-3"
const REFERENCE_COLUMNS = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.5fr)_1.5rem_1.5rem_1.5rem_1.5rem] items-center gap-x-2 px-3"
const NEWLINE = "\n"
const MULTILINE_ROWS = 6
const BLANK_ROW = { name: "", value: "", secret: false, enabled: true }

const matches = (row, needle) => (
  row.name.toLowerCase().includes(needle) || (!row.secret && asText(row.value).toLowerCase().includes(needle))
)

const namedIndex = (rows, name) => (name ? rows.findIndex((row) => row.name === name) : -1)

const draftFor = (rows, name) => (name && namedIndex(rows, name) < 0 ? { ...BLANK_ROW, name } : BLANK_ROW)

function focusFor(rows, name) {
  if (!name) return null
  const index = namedIndex(rows, name)
  return { index: index < 0 ? rows.length : index, field: "value" }
}

const isUnnamed = (row) => row.name.trim() === "" && (asText(row.value) !== "" || Boolean(row.ref))

function ReadOnlyText({ text, label }) {
  return (
    <span aria-label={label} title={text} className="flex h-7 min-w-0 items-center font-mono text-xs text-foreground">
      <span dir="ltr" className="truncate">{text}</span>
    </span>
  )
}

function NameField({ row, isDraft, features, autoFocus, inputRef, onChange }) {
  if (features.readOnly) return <ReadOnlyText text={row.name} label={TEXT.variable} />
  const isMissing = !isDraft && isUnnamed(row)
  return (
    <Input
      ref={inputRef}
      value={row.name}
      autoFocus={autoFocus}
      placeholder={isMissing ? TEXT.nameRequired : TEXT.variable}
      aria-label={TEXT.variable}
      dir="ltr"
      aria-invalid={isMissing}
      spellCheck={false}
      onChange={(event) => onChange({ name: event.target.value })}
      className={cn("font-mono", isMissing && "border-warning placeholder:text-warning")}
    />
  )
}

const lineCount = (row) => asText(row.value).split(NEWLINE).length

const showsLines = (row, isRevealed) => lineCount(row) > 1 && (!row.secret || isRevealed)

function MultilineValue({ text, autoFocus, onBlur, onChange }) {
  const field = useRef(null)
  useEffect(() => {
    if (!autoFocus) return
    field.current.focus()
    field.current.setSelectionRange(text.length, text.length)
  }, [autoFocus])
  return (
    <Textarea
      ref={field}
      rows={Math.min(text.split(NEWLINE).length, MULTILINE_ROWS)}
      value={text}
      placeholder={TEXT.value}
      aria-label={TEXT.value}
      dir="ltr"
      onChange={(event) => onChange({ value: event.target.value })}
      onBlur={onBlur}
    />
  )
}

function ValueInput({ row, isRevealed, readOnly, autoFocus, onBlur, onChange }) {
  const addedLine = useRef(false)
  const [isGrown, setIsGrown] = useState(false)
  const isHidden = row.secret && !isRevealed
  const text = asText(row.value)
  const hasLines = text.includes(NEWLINE)
  useEffect(() => {
    if (hasLines) setIsGrown(true)
  }, [hasLines])
  if (readOnly || (isHidden && hasLines)) return <ReadOnlyText text={isHidden ? TEXT.hiddenValue : text} label={TEXT.value} />
  if (!isHidden && (hasLines || isGrown)) return <MultilineValue text={text} autoFocus={addedLine.current} onBlur={onBlur} onChange={onChange} />
  const addLine = (event) => {
    if (event.key !== "Enter" || !event.shiftKey || isHidden || row.name.trim() === "") return
    event.preventDefault()
    addedLine.current = true
    setIsGrown(true)
    onChange({ value: text + NEWLINE })
  }
  return (
    <Input
      type={isHidden ? "password" : "text"}
      value={text}
      autoFocus={autoFocus}
      placeholder={TEXT.value}
      title={TEXT.valueLines}
      aria-label={TEXT.value}
      dir="ltr"
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      onKeyDown={addLine}
      onBlur={onBlur}
      className="font-mono"
    />
  )
}

function ValueField({ onOpenEditor, ...props }) {
  const { row, isRevealed, readOnly } = props
  const canOpenEditor = Boolean(onOpenEditor) && !readOnly && (!row.secret || isRevealed)
  return (
    <div className={cn("relative min-w-0", canOpenEditor && "[&_input]:pe-8 [&_textarea]:pe-8")}>
      <ValueInput {...props} />
      {canOpenEditor && (
        <IconButton label={TEXT.openEditor} icon={Maximize2} size="icon-xs" onClick={onOpenEditor} className="absolute end-1 top-0.5" />
      )}
    </div>
  )
}

function ReferenceSummary({ reference }) {
  const target = reference.path ? `${reference.provider}: ${reference.path}` : REFERENCE_TEXT.manager
  return (
    <span title={target} className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground">
      <KeyRound className="h-3.5 w-3.5 shrink-0" />
      <span dir="ltr" className="truncate font-mono">{target}</span>
    </span>
  )
}

function RowCells({ row, isDraft, isRevealed, focusField, features, references, onChange, onRemove, onToggleReveal, onOpenEditor }) {
  const canReveal = row.secret
  const toggleReference = () => onChange(row.ref ? { ref: undefined } : { ref: { ...BLANK_REFERENCE, provider: references.connections[0]?.alias ?? "" }, value: "", secret: false })
  const rowRef = useRef(null)
  const isTall = !row.ref && showsLines(row, isRevealed)
  const nameRef = useRef(null)
  const askForName = (event) => {
    if (!isDraft && isUnnamed(row) && rowRef.current?.contains(event.relatedTarget)) nameRef.current?.focus()
  }
  return (
    <div ref={rowRef} className={cn(references ? REFERENCE_COLUMNS : COLUMNS, isTall ? "items-start py-1" : "h-9")}>
      {features.enabled ? (
        <Checkbox
          label={TEXT.enabled}
          checked={row.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className={cn(isDraft && "invisible")}
        />
      ) : <span />}
      <NameField row={row} isDraft={isDraft} features={features} autoFocus={focusField === "name"} inputRef={nameRef} onChange={onChange} />
      {row.ref ? <ReferenceSummary reference={row.ref} /> : <ValueField row={row} isRevealed={isRevealed} readOnly={features.readOnly} autoFocus={focusField === "value"} onBlur={askForName} onChange={onChange} onOpenEditor={onOpenEditor} />}
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

const isUnmarkedCredential = (row, isDraft, features) => (
  features.secret && !features.readOnly && !isDraft && row.enabled && !row.secret && !row.ref && looksLikeCredential(row.name, row.value)
)

function CredentialHint({ onMarkSecret }) {
  return (
    <div role="status" className="flex items-center gap-2 px-3 pb-2 text-xs text-warning">
      <span className="min-w-0 flex-1">{TEXT.looksLikeCredential}</span>
      <Button variant="outline" size="sm" onClick={onMarkSecret}>{TEXT.secret}</Button>
    </div>
  )
}

function Row(props) {
  const { row, isDraft, features, references, onChange } = props
  return (
    <div className={cn("border-b border-border", !row.enabled && "opacity-50")}>
      <RowCells {...props} />
      {isUnmarkedCredential(row, isDraft, features) && <CredentialHint onMarkSecret={() => onChange({ secret: true })} />}
      {row.ref && references && <ReferenceFields reference={row.ref} {...references} onChange={(ref) => onChange({ ref })} />}
    </div>
  )
}

export function EnvironmentTable({ rows, query, features, secrets, draftName = "", note, onChange }) {
  const { connections, kinds, isLoaded } = useSecretConnections(secrets)
  const references = secrets && features.references ? { secrets, connections, kinds, isLoaded } : null
  const [revealed, setRevealed] = useState(() => new Set())
  const [draft, setDraft] = useState(() => draftFor(rows, draftName))
  const [focus, setFocus] = useState(() => focusFor(rows, draftName))
  const [editing, setEditing] = useState(null)
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
    setDraft(BLANK_ROW)
    onChange([...rows, { ...draft, ...patch }])
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
        <span className="flex min-w-0 items-center gap-1">
          <SectionLabel>{TEXT.variable}</SectionLabel>
          {note && <InfoTip text={note} />}
        </span>
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
          onOpenEditor={() => setEditing(index)}
        />
      ))}
      {!features.readOnly && (
        <Row
          isDraft
          row={draft}
          focusField={focus?.index === rows.length ? focus.field : null}
          features={features}
          references={references}
          onChange={addRow}
        />
      )}
      {rows[editing] && (
        <Suspense fallback={<DialogPending />}>
          <VariableValueDialog
            name={rows[editing].name}
            value={asText(rows[editing].value)}
            onChange={(value) => edit(editing, { value })}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
