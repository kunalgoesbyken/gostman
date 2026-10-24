import { useState } from "react"
import { KeyRound, MonitorDown, Pencil, Plus, Trash2 } from "lucide-react"
import { BrandIcon } from "./ui/brandIcon"
import { Button, IconButton } from "./ui/button"
import { ColorPicker } from "./ui/colorPicker"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { FIELD_COLUMNS, Field } from "./ui/field"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { Switch } from "./ui/switch"
import { ConnectionMark } from "./ConnectionMark"
import { BLANK_REFERENCE, ReferenceTarget } from "./SecretReferenceFields"
import { useSecretConnections } from "../hooks/useSecretConnections"
import { connectionColor } from "../lib/secretOrigins"
import { automaticSwatch } from "../lib/swatches"
import { SECRETS_TEXT as TEXT } from "../lib/secretsText"
import { useAppStore } from "../store/appStore"
import { cn } from "../lib/utils"

const NEW_CONNECTION = { alias: "", kind: "", color: "", values: {}, stored: [], isSaved: false }

const labelOf = (kind, field) => TEXT.kindFields[kind]?.[field.name] || TEXT.fields[field.name] || field.name

const hasValue = (draft, name) => Boolean(draft.values[name]?.trim()) || draft.stored.includes(name)

function isComplete(draft, kinds) {
  const kind = kinds.find((candidate) => candidate.name === draft.kind)
  return draft.alias.trim() !== "" && (kind?.fields ?? []).every((field) => !field.required || hasValue(draft, field.name))
}

function useAttempt() {
  const [isWaiting, setIsWaiting] = useState(false)
  const [problem, setProblem] = useState("")
  const attempt = async (action) => {
    setIsWaiting(true)
    setProblem("")
    try {
      await action()
    } catch (error) {
      setProblem(error.message)
    } finally {
      setIsWaiting(false)
    }
  }
  return { isWaiting, problem, attempt }
}

function ConnectionRow({ connection, onSwitch, onEdit, onRemove }) {
  return (
    <div className="flex h-9 items-center gap-3 border-b border-border px-4">
      <ConnectionMark kind={connection.kind} color={connectionColor(connection)} className="text-muted-foreground" />
      <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", connection.disabled && "text-muted-foreground")}>{connection.alias}</span>
      <span className="truncate text-xs text-muted-foreground">{TEXT.kinds[connection.kind] || connection.kind}</span>
      <Switch label={TEXT.switchLabel(connection.alias)} checked={!connection.disabled} onCheckedChange={onSwitch} className="w-14">
        {connection.disabled ? TEXT.turnedOff : TEXT.turnedOn}
      </Switch>
      <IconButton label={TEXT.edit} icon={Pencil} size="icon-xs" onClick={onEdit} />
      <IconButton label={TEXT.remove} icon={Trash2} size="icon-xs" onClick={onRemove} />
    </div>
  )
}

function ConnectionList({ connections, onAdd, onSwitch, onEdit, onRemove }) {
  const addButton = (
    <Button variant="outline" size="sm" onClick={onAdd}>
      <Plus />
      {TEXT.add}
    </Button>
  )
  return (
    <>
      <Notice edge="border-b">{TEXT.intro}</Notice>
      {connections.length === 0 ? (
        <EmptyState icon={KeyRound} title={TEXT.empty} action={addButton} className="min-h-60" />
      ) : (
        <>
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.alias}
              connection={connection}
              onSwitch={(enabled) => onSwitch(connection, enabled)}
              onEdit={() => onEdit(connection)}
              onRemove={() => onRemove(connection)}
            />
          ))}
          <div className="p-4">{addButton}</div>
        </>
      )}
    </>
  )
}

function CredentialInput({ field, draft, onChange }) {
  const isStored = draft.stored.includes(field.name)
  return (
    <Input
      type={field.secret ? "password" : "text"}
      value={draft.values[field.name] ?? ""}
      placeholder={field.secret && isStored ? TEXT.credentialStored : TEXT.placeholders[field.name]}
      aria-required={field.required && !isStored}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange(field.name, event.target.value)}
      className="font-mono"
    />
  )
}

function FieldNote({ role, className, children }) {
  return (
    <div className={FIELD_COLUMNS}>
      <span className="max-sm:hidden" />
      <p role={role} className={cn("text-xs [overflow-wrap:anywhere]", className)}>{children}</p>
    </div>
  )
}

function PairingField({ kind, draft, secrets, onFilled }) {
  const text = TEXT.pairing[kind.name]
  const { isWaiting, problem, attempt } = useAttempt()
  const pairedAs = draft.values.association

  const connect = () => attempt(async () => onFilled(await secrets.pair(kind.name)))

  return (
    <>
      <Field label={text.label} grouped>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" disabled={isWaiting} onClick={connect}>
            {isWaiting ? text.waiting : pairedAs ? text.reconnect : text.connect}
          </Button>
          <p role="status" className={cn("min-w-0 text-xs [overflow-wrap:anywhere]", pairedAs ? "text-success" : "text-muted-foreground")}>
            {isWaiting ? text.prompt : pairedAs ? text.paired(pairedAs) : text.unpaired}
          </p>
        </div>
      </Field>
      {problem && <FieldNote role="alert" className="text-destructive">{problem}</FieldNote>}
    </>
  )
}

function UnlockField({ kind, draft, secrets, onFilled }) {
  const text = TEXT.unlocking[kind.name]
  const { isWaiting, problem, attempt } = useAttempt()
  const [password, setPassword] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)

  const unlock = (event) => {
    event.preventDefault()
    attempt(async () => {
      onFilled(await secrets.unlock({ alias: draft.alias, kind: draft.kind, values: draft.values }, password))
      setPassword("")
      setIsUnlocked(true)
    })
  }

  const edit = (event) => {
    setPassword(event.target.value)
    setIsUnlocked(false)
  }

  return (
    <>
      <Field label={text.label} grouped>
        <form className="flex min-w-0 gap-2" onSubmit={unlock}>
          <Input
            type="password"
            value={password}
            aria-label={text.label}
            autoComplete="off"
            spellCheck={false}
            disabled={isWaiting}
            onChange={edit}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isWaiting || password === ""}>
            {isWaiting ? text.waiting : text.unlock}
          </Button>
        </form>
      </Field>
      <FieldNote
        role={problem ? "alert" : "status"}
        className={problem ? "text-destructive" : isUnlocked ? "text-success" : "text-muted-foreground"}
      >
        {problem || (isUnlocked ? text.unlocked : text.note)}
      </FieldNote>
    </>
  )
}

function ConnectionForm({ draft, isNew, kinds, secrets, onChange, onFilled }) {
  const [reference, setReference] = useState(BLANK_REFERENCE)
  const kind = kinds.find((candidate) => candidate.name === draft.kind)
  const setValue = (name, value) => onChange({ ...draft, values: { ...draft.values, [name]: value } })
  const fill = (values) => onFilled(kind.name, values)
  return (
    <div className="flex flex-col gap-2">
      <Field label={TEXT.alias}>
        <Input
          value={draft.alias}
          disabled={!isNew}
          placeholder={TEXT.aliasPlaceholder}
          spellCheck={false}
          onChange={(event) => onChange({ ...draft, alias: event.target.value })}
        />
      </Field>
      <Field label={TEXT.colour} grouped>
        <ColorPicker label={TEXT.colour} value={draft.color} automatic={draft.alias.trim() && automaticSwatch(draft.alias.trim())} onChange={(color) => onChange({ ...draft, color })} />
      </Field>
      <FieldNote className="text-muted-foreground">{TEXT.colourNote}</FieldNote>
      <Field label={TEXT.kind}>
        <Select value={draft.kind} disabled={!isNew} onChange={(event) => onChange({ ...draft, kind: event.target.value, values: {} })}>
          {kinds.map((candidate) => (
            <option key={candidate.name} value={candidate.name} icon={<BrandIcon brand={candidate.name} fallback={KeyRound} />}>
              {TEXT.kinds[candidate.name] || candidate.name}
            </option>
          ))}
        </Select>
      </Field>
      {TEXT.kindHints[draft.kind] && <FieldNote className="text-muted-foreground">{TEXT.kindHints[draft.kind]}</FieldNote>}
      {kind?.pairing ? (
        <PairingField kind={kind} draft={draft} secrets={secrets} onFilled={fill} />
      ) : (
        <>
          {kind?.unlocking && <UnlockField kind={kind} draft={draft} secrets={secrets} onFilled={fill} />}
          {kind?.fields.map((field) => (
            <Field key={field.name} label={field.required ? `${labelOf(kind.name, field)} *` : labelOf(kind.name, field)}>
              <CredentialInput field={field} draft={draft} onChange={setValue} />
            </Field>
          ))}
        </>
      )}
      {!isNew && (
        <>
          <SectionLabel className="pt-3">{TEXT.testTitle}</SectionLabel>
          <ReferenceTarget reference={{ ...reference, provider: draft.alias }} kind={kind} secrets={secrets} onChange={setReference} />
          <p className="text-xs text-muted-foreground">{TEXT.testHint}</p>
        </>
      )}
    </div>
  )
}

function DesktopOnly() {
  return (
    <DialogBody>
      <EmptyState icon={MonitorDown} title={TEXT.desktopOnlyTitle} description={TEXT.desktopOnly} />
    </DialogBody>
  )
}

function ConnectionManager({ secrets, onClose }) {
  const { connections, kinds, failure } = useSecretConnections(secrets)
  const [editing, setEditing] = useState(null)
  const [problem, setProblem] = useState("")
  const showConfirm = useAppStore((state) => state.showConfirm)

  const startAdding = () => {
    setProblem("")
    setEditing({ ...NEW_CONNECTION, kind: kinds[0]?.name ?? "" })
  }

  const startEditing = (connection) => {
    setProblem("")
    setEditing({ ...connection, color: connection.color || "", values: connection.values || {}, stored: connection.stored || [], isSaved: true })
  }

  const fill = (kindName, values) => setEditing((current) => (
    current?.kind === kindName ? { ...current, values: { ...current.values, ...values } } : current
  ))

  const save = async () => {
    try {
      await secrets.save({ alias: editing.alias, kind: editing.kind, color: editing.color, values: editing.values })
      setEditing(null)
    } catch (error) {
      setProblem(error.message)
    }
  }

  const switchConnection = async (connection, enabled) => {
    setProblem("")
    try {
      await secrets.setEnabled(connection.alias, enabled)
    } catch (error) {
      setProblem(error.message)
    }
  }

  const remove = (connection) => showConfirm(
    TEXT.remove,
    TEXT.confirmRemove(connection.alias),
    () => secrets.remove(connection.alias),
    null,
    "destructive"
  )

  return (
    <>
      <DialogBody className="p-0">
        {editing ? (
          <div className="p-4">
            <ConnectionForm
              draft={editing}
              isNew={!editing.isSaved}
              kinds={kinds}
              secrets={secrets}
              onChange={(next) => { setProblem(""); setEditing(next) }}
              onFilled={fill}
            />
          </div>
        ) : (
          <ConnectionList connections={connections} onAdd={startAdding} onSwitch={switchConnection} onEdit={startEditing} onRemove={remove} />
        )}
      </DialogBody>
      <DialogFooter>
        {(problem || failure) && <p role="alert" className="mr-auto min-w-0 self-center text-xs text-destructive">{problem || failure}</p>}
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>{TEXT.cancel}</Button>
            <Button disabled={!isComplete(editing, kinds)} onClick={save}>{TEXT.save}</Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>{TEXT.close}</Button>
        )}
      </DialogFooter>
    </>
  )
}

export function SecretsDialog({ secrets, onClose }) {
  return (
    <Dialog label={TEXT.title} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      {secrets ? <ConnectionManager secrets={secrets} onClose={onClose} /> : <DesktopOnly />}
    </Dialog>
  )
}
