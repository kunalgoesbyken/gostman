import { useMemo, useState } from "react"
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Notice } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { EnvironmentTable } from "./EnvironmentTable"
import { SearchField } from "./SearchField"
import { SecretsDialog } from "./SecretsDialog"
import { ENVIRONMENT_COLORS, ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { SECRETS_TEXT } from "../lib/secretsText"
import { isDesktopShell } from "../lib/windowControls"
import { SCOPE_COLLECTION, SCOPE_GLOBAL, dotEnvEntries, environmentChain, environmentEntries, withEntries } from "../lib/variableScopes"
import { cn } from "../lib/utils"
import { createEnvironment, useAppStore } from "../store/appStore"

const COLLECTION_VARIABLES_ID = "collection-variables"
const DOT_ENV_ID = "dot-env"
const SCOPE_OPTIONS = [
  { value: SCOPE_COLLECTION, label: TEXT.collectionTab },
  { value: SCOPE_GLOBAL, label: TEXT.globalTab },
]
const ENVIRONMENT_FEATURES = { enabled: true, secret: true, references: true, readOnly: false }
const COLLECTION_FEATURES = { enabled: false, secret: false, readOnly: false }
const DOT_ENV_FEATURES = { enabled: false, secret: false, readOnly: true }

function ColorDot({ color, className }) {
  return <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", ENVIRONMENT_COLORS[color] || "border border-border", className)} />
}

function ColorPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label={TEXT.colour} className="flex items-center gap-1.5">
      {Object.keys(ENVIRONMENT_COLORS).map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          onClick={() => onChange(value === color ? "" : color)}
          className={cn("flex h-5 w-5 items-center justify-center rounded-full", value === color && "ring-1 ring-foreground ring-offset-1 ring-offset-background")}
        >
          <ColorDot color={color} className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}

function ListItem({ label, color, isSelected, isActive, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected}
      className={cn("flex h-8 w-full items-center gap-2 px-3 text-left text-xs", isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent")}
    >
      <ColorDot color={color} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isActive && <Check className="h-3.5 w-3.5 shrink-0" aria-label={TEXT.isActive} />}
    </button>
  )
}

function ExtendsSelect({ environment, environments, onChange }) {
  const candidates = environments.filter((candidate) => (
    candidate.id !== environment.id && !environmentChain(environments, candidate).some((link) => link.id === environment.id)
  ))
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {TEXT.inherits}
      <Select value={environment.extends} onChange={(event) => onChange(event.target.value)} aria-label={TEXT.inherits} className="w-44">
        <option value="">{TEXT.inheritsNone}</option>
        {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
      </Select>
    </label>
  )
}

function EnvironmentEditor({ scope, environment, environments, isActive, canDelete, secrets }) {
  const updateEnvironment = useAppStore((s) => s.updateEnvironment)
  const addEnvironmentTo = useAppStore((s) => s.addEnvironmentTo)
  const removeEnvironmentFrom = useAppStore((s) => s.removeEnvironmentFrom)
  const setActiveEnvironmentIn = useAppStore((s) => s.setActiveEnvironmentIn)
  const showConfirm = useAppStore((s) => s.showConfirm)
  const [rows, setRows] = useState(() => environmentEntries(environment))
  const [name, setName] = useState(environment.name)
  const [query, setQuery] = useState("")
  const patch = (changes) => updateEnvironment(scope, environment.id, changes)

  const editRows = (next) => {
    setRows(next)
    const { variables, meta } = withEntries(environment, next)
    patch({ variables, meta })
  }

  const editName = (value) => {
    setName(value)
    if (value.trim() !== "") patch({ name: value.trim() })
  }

  const duplicate = () => {
    const copy = createEnvironment(`${environment.name} copy`, environment.variables)
    addEnvironmentTo(scope, { ...copy, color: environment.color, extends: environment.extends, meta: environment.meta })
  }

  const remove = () => showConfirm(
    TEXT.remove,
    TEXT.confirmDelete(environment.name),
    () => removeEnvironmentFrom(scope, environment.id),
    null,
    "destructive"
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <Input value={name} onChange={(event) => editName(event.target.value)} aria-label={TEXT.name} placeholder={TEXT.namePlaceholder} controlSize="md" className="w-48" />
        <ColorPicker value={environment.color} onChange={(color) => patch({ color })} />
        <ExtendsSelect environment={environment} environments={environments} onChange={(parent) => patch({ extends: parent })} />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveEnvironmentIn(scope, isActive && scope === SCOPE_GLOBAL ? "" : environment.id)}
            disabled={isActive && scope !== SCOPE_GLOBAL}
          >
            {isActive ? (scope === SCOPE_GLOBAL ? TEXT.stopUsing : TEXT.isActive) : TEXT.makeActive}
          </Button>
          <IconButton label={TEXT.duplicate} icon={Copy} onClick={duplicate} />
          <IconButton label={TEXT.remove} icon={Trash2} onClick={remove} disabled={!canDelete} />
        </div>
      </div>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
      {!secrets && rows.some((row) => row.ref) && <Notice edge="border-b" tone="warning">{SECRETS_TEXT.webReferences}</Notice>}
      <EnvironmentTable rows={rows} query={query} features={ENVIRONMENT_FEATURES} secrets={secrets} onChange={editRows} />
    </>
  )
}

function CollectionVariablesEditor() {
  const collectionVariables = useAppStore((s) => s.collectionVariables)
  const setCollectionVariables = useAppStore((s) => s.setCollectionVariables)
  const [rows, setRows] = useState(() => environmentEntries({ variables: collectionVariables }))
  const [query, setQuery] = useState("")

  const editRows = (next) => {
    setRows(next)
    setCollectionVariables(withEntries({}, next).variables)
  }

  return (
    <>
      <Notice edge="border-b">{TEXT.collectionNote}</Notice>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
      <EnvironmentTable rows={rows} query={query} features={COLLECTION_FEATURES} onChange={editRows} />
    </>
  )
}

function DotEnvViewer() {
  const dotEnv = useAppStore((s) => s.dotEnv)
  const rows = useMemo(() => dotEnvEntries(dotEnv), [dotEnv])
  const [query, setQuery] = useState("")
  return (
    <>
      <Notice edge="border-b">{TEXT.dotEnvNote}</Notice>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
      <EnvironmentTable rows={rows} query={query} features={DOT_ENV_FEATURES} />
    </>
  )
}

function Editor({ scope, selectedId, environments, activeId, secrets }) {
  const environment = environments.find((candidate) => candidate.id === selectedId)
  if (selectedId === COLLECTION_VARIABLES_ID) return <CollectionVariablesEditor key={selectedId} />
  if (selectedId === DOT_ENV_ID) return <DotEnvViewer key={selectedId} />
  if (!environment) return <p className="p-4 text-xs text-muted-foreground">{scope === SCOPE_GLOBAL ? TEXT.emptyGlobal : ""}</p>
  return (
    <EnvironmentEditor
      key={`${scope}:${environment.id}`}
      scope={scope}
      environment={environment}
      environments={environments}
      isActive={environment.id === activeId}
      canDelete={scope === SCOPE_GLOBAL || environments.length > 1}
      secrets={secrets}
    />
  )
}

export function EnvironmentDialog({ secrets, onClose }) {
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const activeGlobalId = useAppStore((s) => s.activeGlobalEnvironmentId)
  const dotEnv = useAppStore((s) => s.dotEnv)
  const addEnvironmentTo = useAppStore((s) => s.addEnvironmentTo)
  const [scope, setScope] = useState(SCOPE_COLLECTION)
  const [selectedId, setSelectedId] = useState(activeEnvironmentId)
  const [isManagingSecrets, setIsManagingSecrets] = useState(false)

  const isGlobal = scope === SCOPE_GLOBAL
  const list = isGlobal ? globalEnvironments : environments
  const activeId = isGlobal ? activeGlobalId : activeEnvironmentId
  const hasDotEnv = !isGlobal && Object.keys(dotEnv).length > 0

  const changeScope = (next) => {
    setScope(next)
    setSelectedId(next === SCOPE_GLOBAL ? globalEnvironments[0]?.id || "" : activeEnvironmentId)
  }

  const create = () => {
    const environment = createEnvironment(isGlobal ? TEXT.newGlobal : TEXT.newEnvironment)
    addEnvironmentTo(scope, environment)
    setSelectedId(environment.id)
  }

  const closeUnlessCovered = () => {
    if (!isManagingSecrets) onClose()
  }

  const resolvedSelection = list.some((candidate) => candidate.id === selectedId) || [COLLECTION_VARIABLES_ID, DOT_ENV_ID].includes(selectedId)
    ? selectedId
    : list[0]?.id || ""

  return (
    <>
      <Dialog label={TEXT.title} size="lg" onClose={closeUnlessCovered} className="max-w-5xl">
        <DialogHeader onClose={onClose}>
          <DialogTitle>{TEXT.title}</DialogTitle>
          <SegmentedControl label={TEXT.scope} options={SCOPE_OPTIONS} value={scope} onChange={changeScope} className="ml-2" />
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setIsManagingSecrets(true)}>
            <KeyRound />
            {SECRETS_TEXT.title}
          </Button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={TEXT.title} className="flex w-56 shrink-0 flex-col border-r border-border">
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {list.map((environment) => (
                <ListItem
                  key={environment.id}
                  label={environment.name}
                  color={environment.color}
                  isSelected={environment.id === resolvedSelection}
                  isActive={environment.id === activeId}
                  onSelect={() => setSelectedId(environment.id)}
                />
              ))}
              {!isGlobal && (
                <ListItem
                  label={TEXT.collectionVariables}
                  isSelected={resolvedSelection === COLLECTION_VARIABLES_ID}
                  onSelect={() => setSelectedId(COLLECTION_VARIABLES_ID)}
                />
              )}
              {hasDotEnv && (
                <ListItem label={TEXT.dotEnv} isSelected={resolvedSelection === DOT_ENV_ID} onSelect={() => setSelectedId(DOT_ENV_ID)} />
              )}
            </div>
            <div className="border-t border-border p-2">
              <Button variant="outline" size="sm" className="w-full" onClick={create}>
                <Plus />
                {isGlobal ? TEXT.newGlobal : TEXT.newEnvironment}
              </Button>
            </div>
          </nav>
          <section className="flex min-w-0 flex-1 flex-col">
            <Editor scope={scope} selectedId={resolvedSelection} environments={list} activeId={activeId} secrets={secrets} />
          </section>
        </div>
        <Notice edge="border-t">{TEXT.precedence} {isDesktopShell() ? TEXT.secretNote : TEXT.secretNoteWeb}</Notice>
      </Dialog>
      {isManagingSecrets && <SecretsDialog secrets={secrets} onClose={() => setIsManagingSecrets(false)} />}
    </>
  )
}
