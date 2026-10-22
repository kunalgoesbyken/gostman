import { useState } from "react"
import { KeyRound, MonitorDown, Pencil, Plus, Trash2 } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { BLANK_REFERENCE, ReferenceTarget } from "./SecretReferenceFields"
import { useSecretConnections } from "../hooks/useSecretConnections"
import { SECRETS_TEXT as TEXT } from "../lib/secretsText"
import { useAppStore } from "../store/appStore"

const NEW_CONNECTION = { alias: "", kind: "", values: {}, stored: [], isSaved: false }

const labelOf = (field) => TEXT.fields[field.name] || field.name

function ConnectionRow({ connection, onEdit, onRemove }) {
  return (
    <div className="flex h-9 items-center gap-3 border-b border-border px-4">
      <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{connection.alias}</span>
      <span className="truncate text-xs text-muted-foreground">{TEXT.kinds[connection.kind] || connection.kind}</span>
      <IconButton label={TEXT.edit} icon={Pencil} size="icon-xs" onClick={onEdit} />
      <IconButton label={TEXT.remove} icon={Trash2} size="icon-xs" onClick={onRemove} />
    </div>
  )
}

function ConnectionList({ connections, onAdd, onEdit, onRemove }) {
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

function ConnectionForm({ draft, isNew, kinds, secrets, onChange }) {
  const [reference, setReference] = useState(BLANK_REFERENCE)
  const kind = kinds.find((candidate) => candidate.name === draft.kind)
  const setValue = (name, value) => onChange({ ...draft, values: { ...draft.values, [name]: value } })
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
      <Field label={TEXT.kind}>
        <Select value={draft.kind} disabled={!isNew} onChange={(event) => onChange({ ...draft, kind: event.target.value, values: {} })}>
          {kinds.map((candidate) => <option key={candidate.name} value={candidate.name}>{TEXT.kinds[candidate.name] || candidate.name}</option>)}
        </Select>
      </Field>
      {kind?.fields.map((field) => (
        <Field key={field.name} label={field.required ? `${labelOf(field)} *` : labelOf(field)}>
          <CredentialInput field={field} draft={draft} onChange={setValue} />
        </Field>
      ))}
      {!isNew && (
        <>
          <SectionLabel className="pt-3">{TEXT.testTitle}</SectionLabel>
          <ReferenceTarget reference={{ ...reference, provider: draft.alias }} kind={draft.kind} secrets={secrets} onChange={setReference} />
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
  const { connections, kinds, failure, reload } = useSecretConnections(secrets)
  const [editing, setEditing] = useState(null)
  const [problem, setProblem] = useState("")
  const showConfirm = useAppStore((state) => state.showConfirm)

  const startAdding = () => {
    setProblem("")
    setEditing({ ...NEW_CONNECTION, kind: kinds[0]?.name ?? "" })
  }

  const startEditing = (connection) => {
    setProblem("")
    setEditing({ ...connection, values: connection.values || {}, stored: connection.stored || [], isSaved: true })
  }

  const save = async () => {
    try {
      await secrets.save({ alias: editing.alias, kind: editing.kind, values: editing.values })
      setEditing(null)
      await reload()
    } catch (error) {
      setProblem(error.message)
    }
  }

  const remove = (connection) => showConfirm(
    TEXT.remove,
    TEXT.confirmRemove(connection.alias),
    async () => {
      await secrets.remove(connection.alias)
      await reload()
    },
    null,
    "destructive"
  )

  return (
    <>
      <DialogBody className="p-0">
        {editing ? (
          <div className="p-4">
            <ConnectionForm draft={editing} isNew={!editing.isSaved} kinds={kinds} secrets={secrets} onChange={(next) => { setProblem(""); setEditing(next) }} />
          </div>
        ) : (
          <ConnectionList connections={connections} onAdd={startAdding} onEdit={startEditing} onRemove={remove} />
        )}
      </DialogBody>
      <DialogFooter>
        {(problem || failure) && <p role="alert" className="mr-auto min-w-0 self-center text-xs text-destructive">{problem || failure}</p>}
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>{TEXT.cancel}</Button>
            <Button disabled={editing.alias.trim() === ""} onClick={save}>{TEXT.save}</Button>
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
