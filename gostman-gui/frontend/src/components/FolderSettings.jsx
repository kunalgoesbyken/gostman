import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Notice, Panel, PanelBody, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { OverflowTabsList, Tabs, TabsContent } from "./ui/tabs"
import { AuthPanel } from "./AuthPanel"
import { CollectionVariablesTable } from "./CollectionVariablesTable"
import { EnvironmentTable } from "./EnvironmentTable"
import { KeyValueEditor } from "./KeyValueEditor"
import { HEADER_SUGGESTIONS } from "../lib/httpHeaders"
import { MarkdownField } from "./MarkdownField"
import { AssertionEditor, ScriptEditor } from "./TestsPanel"
import { isPlainObject, parseJSON } from "../lib/dataUtils"
import { ENVIRONMENT_TEXT } from "../lib/environmentText"
import { hasCollectionLists, holdsCollections, isCollectionFolder, ownsCollectionVariables } from "../lib/environmentScope"
import { FOLDER_SETTINGS_TEXT as TEXT } from "../lib/folderSettingsText"
import { AUTH_INHERIT, AUTH_NONE, ROOT_SETTINGS_ID, hasActiveSettings, inheritedAuthLayer, normalizeScopeSettings, settingsTitle } from "../lib/inheritance"
import { cancelSignIn, clearToken, discoverIssuer, obtainToken } from "../lib/oauth"
import { OAUTH_TEXT } from "../lib/oauthText"
import { parseRows, serializeRows } from "../lib/rows"
import { EXECUTION_TEXT } from "../lib/executionText"
import { isDesktopShell } from "../lib/windowControls"
import { MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, TIMEOUT_MS } from "../lib/scripting/limits"
import { environmentEntries, withEntries } from "../lib/variableScopes"
import { environmentForFolder, useAppStore, variableTextFor } from "../store/appStore"

const TAB_HEADERS = "headers"
const TAB_AUTH = "auth"
const TAB_VARS = "vars"
const TAB_SCRIPT = "script"
const TAB_TESTS = "tests"
const TAB_DOCS = "docs"
const VIEW_PRE = "preScript"
const VIEW_POST = "postScript"
const tabItems = () => Object.entries(TEXT.tabs).map(([value, label]) => ({ value, label, content: label }))
const VARIABLE_FEATURES = { enabled: false, secret: false, readOnly: false }
const SCRIPT_VIEWS = [
  { value: VIEW_PRE, get label() { return TEXT.preScript } },
  { value: VIEW_POST, get label() { return TEXT.postScript } },
]

const VARS_COLLECTION = "collection"
const VARS_FOLDER = "folder"
const VARS_VIEWS = [
  { value: VARS_COLLECTION, get label() { return ENVIRONMENT_TEXT.collectionVariables } },
  { value: VARS_FOLDER, get label() { return TEXT.folderVariables } },
]

const isVariableObject = (text) => isPlainObject(parseJSON(text, null))

const secretNote = () => (isDesktopShell() ? ENVIRONMENT_TEXT.secretNote : ENVIRONMENT_TEXT.secretNoteWeb)

function FolderVariables({ variables, onChange }) {
  const [rows, setRows] = useState(() => environmentEntries({ variables }))
  const editRows = (next) => {
    setRows(next)
    onChange(withEntries({}, next).variables)
  }

  return (
    <>
      <Notice>{isVariableObject(variables) ? TEXT.varsNote : TEXT.varsInvalid}</Notice>
      <EnvironmentTable rows={rows} query="" features={VARIABLE_FEATURES} onChange={editRows} />
    </>
  )
}

function CollectionVariables({ holder, note }) {
  return (
    <>
      <Notice>{note} {secretNote()}</Notice>
      <CollectionVariablesTable key={holder?.id} holder={holder} />
    </>
  )
}

function CollectionVarsTab({ folder, onChange }) {
  const [view, setView] = useState(VARS_COLLECTION)
  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label={TEXT.varsKind} options={VARS_VIEWS} value={view} onChange={setView} />
      </Toolbar>
      {view === VARS_COLLECTION
        ? <CollectionVariables holder={folder} note={ENVIRONMENT_TEXT.ownCollectionNote(folder.name)} />
        : <FolderVariables variables={folder.variables} onChange={(variables) => onChange({ variables })} />}
    </Panel>
  )
}

function rootVariablesNote(state) {
  if (holdsCollections(state.workspaceStatus.path)) return ENVIRONMENT_TEXT.sharedCollectionNote
  return hasCollectionLists(state.folders) ? ENVIRONMENT_TEXT.sharedFolderNote : ENVIRONMENT_TEXT.collectionNote
}

function VarsTab({ folder, isCollection, rootNote, onChange }) {
  if (!folder) return <Panel><CollectionVariables note={rootNote} /></Panel>
  if (isCollection) return <CollectionVarsTab folder={folder} onChange={onChange} />
  return <Panel><FolderVariables variables={folder.variables} onChange={(variables) => onChange({ variables })} /></Panel>
}

const MS_PER_SECOND = 1000

const timeLimitOf = (text) => Math.min(Math.round(Number(text) * MS_PER_SECOND) || 0, MAX_TIMEOUT_MS)

function TimeLimitField({ value, onChange }) {
  return (
    <label className="ms-auto flex items-center gap-2 text-xs text-muted-foreground" title={TEXT.timeLimitNote}>
      <span className="max-sm:sr-only">{TEXT.timeLimit}</span>
      <Input
        type="number"
        min={MIN_TIMEOUT_MS / MS_PER_SECOND}
        max={MAX_TIMEOUT_MS / MS_PER_SECOND}
        value={value ? value / MS_PER_SECOND : ""}
        placeholder={String(TIMEOUT_MS / MS_PER_SECOND)}
        aria-label={TEXT.timeLimit}
        onChange={(event) => onChange({ scriptTimeoutMs: timeLimitOf(event.target.value) })}
        className="w-20"
      />
    </label>
  )
}

function ScriptTab({ settings, path, isCollection, EditorComponent, onChange }) {
  const [view, setView] = useState(VIEW_PRE)

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label={TEXT.tabs.script} options={SCRIPT_VIEWS} value={view} onChange={setView} />
        {isCollection && <TimeLimitField value={settings.scriptTimeoutMs} onChange={onChange} />}
      </Toolbar>
      <Notice>{TEXT.scriptNote}</Notice>
      <ScriptEditor
        key={view}
        value={settings[view]}
        path={`${path}/${view}`}
        label={SCRIPT_VIEWS.find((option) => option.value === view).label}
        onChange={(script) => onChange({ [view]: script })}
        EditorComponent={EditorComponent}
      />
    </Panel>
  )
}

function DocsTab({ description, onChange }) {
  return (
    <Panel>
      <Notice>{TEXT.docsNote}</Notice>
      <PanelBody>
        <MarkdownField
          value={description}
          onChange={(next) => onChange({ description: next })}
          placeholder={TEXT.docsPlaceholder}
          rows={14}
          label={TEXT.tabs.docs}
          className="font-sans"
        />
      </PanelBody>
    </Panel>
  )
}

function useFolderAuthActions(backend, scopeId, auth, onChange) {
  const [tokenRequest, setTokenRequest] = useState(null)
  const scopeVariables = () => variableTextFor(useAppStore.getState(), { folderId: scopeId, vars: "" })

  const getToken = async () => {
    if (useAppStore.getState().isRestricted) {
      setTokenRequest({ isPending: false, error: EXECUTION_TEXT.restricted })
      return
    }
    setTokenRequest({ isPending: true, error: "" })
    try {
      const environmentId = environmentForFolder(useAppStore.getState(), scopeId)?.id || ""
      const onDevice = (device) => setTokenRequest({ isPending: true, error: "", device })
      const oauth2 = await obtainToken(backend, auth.oauth2, scopeVariables(), {}, { environmentId, onDevice })
      onChange({ auth: { ...auth, oauth2 } })
      setTokenRequest(null)
    } catch (error) {
      setTokenRequest({ isPending: false, error: error.message })
    }
  }

  const discoverEndpoints = async () => {
    setTokenRequest({ isPending: true, isDiscovering: true, error: "" })
    try {
      const oauth2 = await discoverIssuer(backend, auth.oauth2, scopeVariables(), {})
      onChange({ auth: { ...auth, oauth2 } })
      setTokenRequest({ isPending: false, error: "", notice: OAUTH_TEXT.discovered(oauth2.issuer) })
    } catch (error) {
      setTokenRequest({ isPending: false, error: error.message })
    }
  }

  const actions = {
    getToken,
    discoverEndpoints,
    cancelToken: () => cancelSignIn(backend),
    forgetToken: () => onChange({ auth: { ...auth, oauth2: clearToken(auth.oauth2) } }),
    oauthCallback: backend.oauthCallback,
  }
  return { tokenRequest, actions }
}

function AuthTab({ backend, scopeId, auth, source, sourceType, isCollection, onChange }) {
  const { tokenRequest, actions } = useFolderAuthActions(backend, scopeId, auth, onChange)
  const inheritance = isCollection ? undefined : { source, sourceType, noAuthValue: AUTH_NONE, noAuthNote: TEXT.folderNoAuth }
  const shown = isCollection ? auth : { ...auth, type: auth.type || AUTH_INHERIT }

  return (
    <Panel>
      <Notice>{TEXT.authNote}</Notice>
      <AuthPanel auth={shown} tokenRequest={tokenRequest} actions={actions} inheritance={inheritance} onChange={(next) => onChange({ auth: next })} />
    </Panel>
  )
}

function useScope(scope) {
  const folder = useAppStore((state) => state.folders.find((candidate) => candidate.id === scope.folderId))
  const collectionSettings = useAppStore((state) => state.collectionSettings)
  const parentSource = useAppStore((state) => (folder ? inheritedAuthLayer(state, folder.parentId)?.name ?? null : null))
  const parentSourceType = useAppStore((state) => (folder ? inheritedAuthLayer(state, folder.parentId)?.settings.auth.type ?? null : null))
  const title = useAppStore((state) => settingsTitle(state, folder))
  const ownsCollectionList = useAppStore((state) => isCollectionFolder(state.folders, scope.folderId) || ownsCollectionVariables(state.folders.find((candidate) => candidate.id === scope.folderId)))
  const rootNote = useAppStore(rootVariablesNote)
  const isCollection = scope.folderId === ROOT_SETTINGS_ID
  const source = isCollection ? collectionSettings : folder
  return { source, folder, isCollection, ownsCollectionList, rootNote, parentSource, parentSourceType, title }
}

const SETTINGS_WINDOW = { id: "folder-settings", width: 768, height: 576, minWidth: 480, minHeight: 360 }

export function FolderSettings({ backend, scope, EditorComponent, onClose }) {
  const [tab, setTab] = useState(TAB_HEADERS)
  const { source, folder, isCollection, ownsCollectionList, rootNote, parentSource, parentSourceType, title } = useScope(scope)
  const isRestricted = useAppStore((state) => state.isRestricted)
  const update = useAppStore((state) => state.updateScopeSettings)
  const settings = useMemo(() => normalizeScopeSettings(source), [source])
  const patch = (changes) => update(scope.folderId, changes)

  useEffect(() => {
    if (!source) onClose()
  }, [source, onClose])

  if (!source) return null
  const path = `settings/${scope.folderId || "collection"}`

  return (
    <Dialog label={title} size="lg" floating={SETTINGS_WINDOW} onClose={onClose}>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader onClose={onClose}>
          <DialogTitle>{title}</DialogTitle>
          <OverflowTabsList label={title} items={tabItems()} moreLabel={TEXT.more} moreHint={TEXT.moreHint} className="ms-4 max-sm:ms-0" />
        </DialogHeader>
        {isRestricted && hasActiveSettings(settings) && <Notice tone="warning">{TEXT.restrictedNote}</Notice>}
        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent value={TAB_HEADERS} className="h-full min-h-0">
            <Panel>
              <Notice>{TEXT.headersNote}</Notice>
              <KeyValueEditor
                rows={parseRows(settings.headers)}
                onChange={(rows) => patch({ headers: serializeRows(rows) })}
                keyLabel={TEXT.headerLabel}
                suggestions={HEADER_SUGGESTIONS}
              />
            </Panel>
          </TabsContent>
          <TabsContent value={TAB_AUTH} className="h-full min-h-0">
            <AuthTab
              backend={backend}
              scopeId={scope.folderId}
              auth={settings.auth}
              source={parentSource}
              sourceType={parentSourceType}
              isCollection={isCollection}
              onChange={patch}
            />
          </TabsContent>
          <TabsContent value={TAB_VARS} className="h-full min-h-0">
            <VarsTab folder={folder} isCollection={ownsCollectionList} rootNote={rootNote} onChange={patch} />
          </TabsContent>
          <TabsContent value={TAB_SCRIPT} className="h-full min-h-0">
            <ScriptTab settings={settings} path={path} isCollection={isCollection} EditorComponent={EditorComponent} onChange={patch} />
          </TabsContent>
          <TabsContent value={TAB_TESTS} className="h-full min-h-0">
            <Panel>
              <Notice>{TEXT.testsNote}</Notice>
              <AssertionEditor assertions={settings.assertions} onChange={(assertions) => patch({ assertions })} EditorComponent={EditorComponent} />
            </Panel>
          </TabsContent>
          <TabsContent value={TAB_DOCS} className="h-full min-h-0">
            <DocsTab description={settings.description} onChange={patch} />
          </TabsContent>
        </div>
      </Tabs>
    </Dialog>
  )
}
