import { Fragment, useMemo, useState } from "react"
import { Braces, Check, Copy, FileText, KeyRound, Plus, Timer, Trash2 } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { ColorDot, ColorPicker } from "./ui/colorPicker"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Notice, SectionLabel, SPLIT_LIST, SPLIT_PANES } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { CollectionVariablesTable } from "./CollectionVariablesTable"
import { EnvironmentTable } from "./EnvironmentTable"
import { SearchField } from "./SearchField"
import { SecretsDialog } from "./SecretsDialog"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { SECRETS_TEXT } from "../lib/secretsText"
import { isDesktopShell } from "../lib/windowControls"
import { SCOPE_COLLECTION, SCOPE_GLOBAL, dotEnvEntries, environmentChain, environmentEntries, sessionEntries, withEntries } from "../lib/variableScopes"
import { cn } from "../lib/utils"
import { collectionFolders, environmentGroups, holdsCollections, scopeForNew, variableHolderFor } from "../lib/environmentScope"
import { useEnvironmentChoice } from "../hooks/useEnvironmentChoice"
import { createEnvironment, useAppStore } from "../store/appStore"

const COLLECTION_VARIABLES_ID = "collection-variables"
const SHARED_VARIABLES_ID = "shared-collection-variables"
const DOT_ENV_ID = "dot-env"
const SESSION_ID = "session-values"
const SCOPE_OPTIONS = [
  { value: SCOPE_COLLECTION, label: TEXT.environmentsTab },
  { value: SCOPE_GLOBAL, label: TEXT.globalsTab },
]
const ENVIRONMENT_FEATURES = { enabled: true, secret: true, references: true, readOnly: false }
const DOT_ENV_FEATURES = { enabled: false, secret: false, readOnly: true }

const ENVIRONMENTS_WINDOW = { id: "environments", width: 1024, height: 640, minWidth: 640, minHeight: 400 }

const groupName = (group) => (group.id ? group.name : TEXT.shared)

const SHARED_SECTION = "shared"
const MORE_SECTION = "more"

const sectionOptions = (section) => section.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)

function ListMarker({ icon: Icon, color }) {
  return (
    <span className="flex w-3 shrink-0 justify-center">
      {Icon ? <Icon aria-hidden="true" className="h-3 w-3" /> : <ColorDot color={color} />}
    </span>
  )
}

function ListItem({ label, color, icon, isSelected, isActive, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected}
      className={cn("flex h-8 w-full items-center gap-2 px-3 text-left text-xs", isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent")}
    >
      <ListMarker icon={icon} color={color} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isActive && <Check className="h-3.5 w-3.5 shrink-0" aria-label={TEXT.isActive} />}
    </button>
  )
}

function variableListOf(group, collectionId, holder, hasSharedVariables) {
  if (group.id === "") return !holder ? COLLECTION_VARIABLES_ID : hasSharedVariables ? SHARED_VARIABLES_ID : ""
  return holder && group.id === collectionId ? COLLECTION_VARIABLES_ID : ""
}

const withVariableLists = (groups, collectionId, holder, hasSharedVariables) => groups
  .map((group) => ({ ...group, variables: variableListOf(group, collectionId, holder, hasSharedVariables) }))
  .filter((group) => group.environments.length > 0 || group.variables)

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

function ScopeSelect({ owner, collections, onChange }) {
  const choices = owner && !collections.includes(owner) ? [...collections, owner] : collections
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {TEXT.availableIn}
      <Select value={owner?.id || ""} onChange={(event) => onChange(event.target.value)} aria-label={TEXT.availableIn} className="w-44">
        <option value="">{TEXT.everyCollection}</option>
        {choices.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </Select>
    </label>
  )
}

function EnvironmentEditor({ scope, environment, environments, isActive, scoping, canDelete, secrets, pendingVariable }) {
  const updateEnvironment = useAppStore((s) => s.updateEnvironment)
  const addEnvironmentTo = useAppStore((s) => s.addEnvironmentTo)
  const removeEnvironmentFrom = useAppStore((s) => s.removeEnvironmentFrom)
  const setActiveEnvironmentIn = useAppStore((s) => s.setActiveEnvironmentIn)
  const showConfirm = useAppStore((s) => s.showConfirm)
  const [rows, setRows] = useState(() => environmentEntries(environment))
  const [name, setName] = useState(environment.name)
  const [query, setQuery] = useState("")
  const patch = (changes) => updateEnvironment(scope, environment.id, changes)
  const isOffered = !scoping || scoping.offered.some((candidate) => candidate.id === environment.id)
  const owner = scoping?.folders.find((folder) => folder.id === environment.folderId)

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
    const copy = createEnvironment(`${environment.name} copy`, environment.variables, environment.folderId || "")
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
        <ColorPicker label={TEXT.colour} value={environment.color} onChange={(color) => patch({ color })} />
        <ExtendsSelect environment={environment} environments={environments} onChange={(parent) => patch({ extends: parent })} />
        {(scoping?.collections.length > 1 || owner) && <ScopeSelect owner={owner} collections={scoping.collections} onChange={(folderId) => patch({ folderId })} />}
        <div className="ml-auto flex items-center gap-1">
          {isOffered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveEnvironmentIn(scope, isActive && scope === SCOPE_GLOBAL ? "" : environment.id)}
              disabled={isActive && scope !== SCOPE_GLOBAL}
            >
              {isActive ? (scope === SCOPE_GLOBAL ? TEXT.stopUsing : TEXT.isActive) : TEXT.makeActive}
            </Button>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">{TEXT.otherCollection(owner?.name || "")}</span>
          )}
          <IconButton label={TEXT.duplicate} icon={Copy} onClick={duplicate} />
          <IconButton label={TEXT.remove} icon={Trash2} onClick={remove} disabled={!canDelete} />
        </div>
      </div>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
      {!secrets && rows.some((row) => row.ref) && <Notice edge="border-b" tone="warning">{SECRETS_TEXT.webReferences}</Notice>}
      <EnvironmentTable rows={rows} query={query} features={ENVIRONMENT_FEATURES} secrets={secrets} draftName={pendingVariable} onChange={editRows} />
    </>
  )
}

function CollectionVariablesEditor({ holder, isShared }) {
  const [query, setQuery] = useState("")
  const sharedNote = useAppStore((s) => (holdsCollections(s.workspaceStatus.path) ? TEXT.sharedCollectionNote : TEXT.sharedFolderNote))
  return (
    <>
      <Notice edge="border-b">{holder ? TEXT.ownCollectionNote(holder.name) : isShared ? sharedNote : TEXT.collectionNote}</Notice>
      <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
      <CollectionVariablesTable holder={holder} query={query} />
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

function SessionValuesViewer() {
  const sessionVariables = useAppStore((s) => s.sessionVariables)
  const clearSessionVariables = useAppStore((s) => s.clearSessionVariables)
  const rows = useMemo(() => sessionEntries(sessionVariables), [sessionVariables])
  const [query, setQuery] = useState("")
  return (
    <>
      <Notice edge="border-b">{TEXT.sessionNote}</Notice>
      <div className="flex items-center justify-end border-b border-border px-3 py-2">
        <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={clearSessionVariables}>
          <Trash2 />
          {TEXT.clearSession}
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">{TEXT.sessionEmpty}</p>
      ) : (
        <>
          <SearchField value={query} onChange={setQuery} placeholder={TEXT.search} />
          <EnvironmentTable rows={rows} query={query} features={DOT_ENV_FEATURES} />
        </>
      )}
    </>
  )
}

function Editor({ scope, selectedId, environments, activeId, scoping, holder, secrets, pendingVariable }) {
  const environment = environments.find((candidate) => candidate.id === selectedId)
  if (selectedId === COLLECTION_VARIABLES_ID) return <CollectionVariablesEditor key={`${selectedId}:${holder?.id}`} holder={holder} />
  if (selectedId === SHARED_VARIABLES_ID) return <CollectionVariablesEditor key={selectedId} isShared />
  if (selectedId === DOT_ENV_ID) return <DotEnvViewer key={selectedId} />
  if (selectedId === SESSION_ID) return <SessionValuesViewer key={selectedId} />
  if (!environment) return <p className="p-4 text-xs text-muted-foreground">{scope === SCOPE_GLOBAL ? TEXT.emptyGlobal : ""}</p>
  return (
    <EnvironmentEditor
      key={`${scope}:${environment.id}`}
      scope={scope}
      environment={environment}
      environments={environments}
      isActive={environment.id === activeId}
      scoping={scoping}
      canDelete={scope === SCOPE_GLOBAL || environments.length > 1}
      secrets={secrets}
      pendingVariable={scope === SCOPE_COLLECTION && environment.id === activeId ? pendingVariable : ""}
    />
  )
}

export function EnvironmentDialog({ secrets, onClose }) {
  const environments = useAppStore((s) => s.environments)
  const folders = useAppStore((s) => s.folders)
  const canScope = useAppStore((s) => holdsCollections(s.workspaceStatus.path))
  const { folderId, collectionId, offered, active } = useEnvironmentChoice()
  const activeEnvironmentId = active?.id || ""
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const activeGlobalId = useAppStore((s) => s.activeGlobalEnvironmentId)
  const dotEnv = useAppStore((s) => s.dotEnv)
  const addEnvironmentTo = useAppStore((s) => s.addEnvironmentTo)
  const pendingVariable = useAppStore((s) => s.pendingVariable)
  const [scope, setScope] = useState(SCOPE_COLLECTION)
  const [selectedId, setSelectedId] = useState(activeEnvironmentId)
  const [isManagingSecrets, setIsManagingSecrets] = useState(false)

  const isGlobal = scope === SCOPE_GLOBAL
  const list = isGlobal ? globalEnvironments : environments
  const activeId = isGlobal ? activeGlobalId : activeEnvironmentId
  const hasDotEnv = !isGlobal && Object.keys(dotEnv).length > 0
  const holder = variableHolderFor(folders, folderId)
  const hasSharedVariables = useAppStore((s) => environmentEntries({ variables: s.collectionVariables }).length > 0)
  const groups = useMemo(
    () => (isGlobal
      ? [{ id: "", environments: globalEnvironments }]
      : withVariableLists(environmentGroups(environments, folders, folderId), collectionId, holder, hasSharedVariables)),
    [isGlobal, globalEnvironments, environments, folders, folderId, collectionId, holder, hasSharedVariables]
  )
  const isGrouped = groups.some((group) => group.id !== "")
  const firstOther = groups.find((group) => group.id !== "" && group.id !== collectionId)
  const scoping = useMemo(
    () => (isGlobal ? null : { folders, collections: canScope ? collectionFolders(folders) : [], offered }),
    [isGlobal, folders, canScope, offered]
  )

  const changeScope = (next) => {
    setScope(next)
    setSelectedId(next === SCOPE_GLOBAL ? globalEnvironments[0]?.id || "" : activeEnvironmentId)
  }

  const create = () => {
    const environment = isGlobal
      ? createEnvironment(TEXT.newGlobal)
      : createEnvironment(TEXT.newEnvironment, undefined, scopeForNew(environments, folders, folderId))
    addEnvironmentTo(scope, environment)
    setSelectedId(environment.id)
  }

  const closeUnlessCovered = () => {
    if (!isManagingSecrets) onClose()
  }

  const sections = [
    ...groups.map((group) => ({
      key: group.id || SHARED_SECTION,
      label: isGrouped ? groupName(group) : "",
      separated: group === firstOther,
      items: [
        ...group.environments.map((environment) => ({ id: environment.id, label: environment.name, color: environment.color, isActive: environment.id === activeId })),
        ...(isGrouped && group.variables ? [{ id: group.variables, label: TEXT.collectionVariables, icon: Braces }] : []),
      ],
    })),
    {
      key: MORE_SECTION,
      label: "",
      separated: isGrouped,
      items: [
        ...(!isGrouped && !isGlobal ? [{ id: COLLECTION_VARIABLES_ID, label: TEXT.collectionVariables, icon: Braces }] : []),
        ...(hasDotEnv ? [{ id: DOT_ENV_ID, label: TEXT.dotEnv, icon: FileText }] : []),
        ...(!isGlobal ? [{ id: SESSION_ID, label: TEXT.sessionValues, icon: Timer }] : []),
      ],
    },
  ]

  const resolvedSelection = list.some((candidate) => candidate.id === selectedId) || [COLLECTION_VARIABLES_ID, SHARED_VARIABLES_ID, DOT_ENV_ID, SESSION_ID].includes(selectedId)
    ? selectedId
    : list[0]?.id || ""

  return (
    <>
      <Dialog label={TEXT.title} size="lg" floating={ENVIRONMENTS_WINDOW} onClose={closeUnlessCovered} className="max-w-5xl">
        <DialogHeader onClose={onClose}>
          <DialogTitle>{TEXT.title}</DialogTitle>
          <SegmentedControl label={TEXT.scope} options={SCOPE_OPTIONS} value={scope} onChange={changeScope} className="ml-2" />
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setIsManagingSecrets(true)}>
            <KeyRound />
            <span className="max-sm:sr-only">{SECRETS_TEXT.title}</span>
          </Button>
        </DialogHeader>
        <div className={SPLIT_PANES}>
          <nav aria-label={TEXT.title} className={cn(SPLIT_LIST, "w-56")}>
            <div className="min-h-0 flex-1 overflow-y-auto py-1 max-sm:hidden">
              {sections.map((section) => (
                <Fragment key={section.key}>
                  {section.separated && <div role="separator" className="my-1 border-t border-border" />}
                  {section.label && <SectionLabel className="block truncate px-3 pb-1 pt-2" title={section.label}>{section.label}</SectionLabel>}
                  {section.items.map((item) => (
                    <ListItem key={item.id} {...item} isSelected={item.id === resolvedSelection} onSelect={() => setSelectedId(item.id)} />
                  ))}
                </Fragment>
              ))}
            </div>
            <div className="p-2 pb-0 sm:hidden">
              <Select value={resolvedSelection} onChange={(event) => setSelectedId(event.target.value)} aria-label={TEXT.title}>
                {sections.map((section) => (section.label
                  ? <optgroup key={section.key} label={section.label}>{sectionOptions(section)}</optgroup>
                  : <Fragment key={section.key}>{sectionOptions(section)}</Fragment>
                ))}
              </Select>
            </div>
            <div className="border-t border-border p-2">
              <Button variant="outline" size="sm" className="w-full" onClick={create}>
                <Plus />
                {isGlobal ? TEXT.newGlobal : TEXT.newEnvironment}
              </Button>
            </div>
          </nav>
          <section className="flex min-w-0 flex-1 flex-col">
            <Editor scope={scope} selectedId={resolvedSelection} environments={list} activeId={activeId} scoping={scoping} holder={holder} secrets={secrets} pendingVariable={pendingVariable} />
          </section>
        </div>
        <Notice edge="border-t">{TEXT.precedence} {isDesktopShell() ? TEXT.secretNote : TEXT.secretNoteWeb}</Notice>
      </Dialog>
      {isManagingSecrets && <SecretsDialog secrets={secrets} onClose={() => setIsManagingSecrets(false)} />}
    </>
  )
}
