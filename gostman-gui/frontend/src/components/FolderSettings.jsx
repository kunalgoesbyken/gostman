import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Notice, Panel, PanelBody, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Textarea } from "./ui/textarea"
import { AuthPanel } from "./AuthPanel"
import { EnvironmentTable } from "./EnvironmentTable"
import { KeyValueEditor } from "./KeyValueEditor"
import { AssertionEditor, ScriptEditor } from "./TestsPanel"
import { isPlainObject, parseJSON } from "../lib/dataUtils"
import { FOLDER_SETTINGS_TEXT as TEXT } from "../lib/folderSettingsText"
import { AUTH_INHERIT, ROOT_SETTINGS_ID, hasActiveSettings, inheritedAuthSource, lineageOf, normalizeScopeSettings } from "../lib/inheritance"
import { clearToken, obtainToken } from "../lib/oauth"
import { parseRows, serializeRows } from "../lib/rows"
import { RESTRICTED } from "../lib/execution"
import { environmentEntries, withEntries } from "../lib/variableScopes"
import { useAppStore, variableTextFor } from "../store/appStore"

const TAB_HEADERS = "headers"
const TAB_AUTH = "auth"
const TAB_VARS = "vars"
const TAB_SCRIPT = "script"
const TAB_TESTS = "tests"
const TAB_DOCS = "docs"
const VIEW_PRE = "preScript"
const VIEW_POST = "postScript"
const NO_AUTH = "none"
const VARIABLE_FEATURES = { enabled: false, secret: false, readOnly: false }
const SCRIPT_VIEWS = [
  { value: VIEW_PRE, label: TEXT.preScript },
  { value: VIEW_POST, label: TEXT.postScript },
]

const isVariableObject = (text) => isPlainObject(parseJSON(text, null))

function VariablesTab({ variables, onChange }) {
  const [rows, setRows] = useState(() => environmentEntries({ variables }))
  const editRows = (next) => {
    setRows(next)
    onChange(withEntries({}, next).variables)
  }

  return (
    <Panel>
      <Notice>{isVariableObject(variables) ? TEXT.varsNote : TEXT.varsInvalid}</Notice>
      <EnvironmentTable rows={rows} query="" features={VARIABLE_FEATURES} onChange={editRows} />
    </Panel>
  )
}

function ScriptTab({ settings, path, EditorComponent, onChange }) {
  const [view, setView] = useState(VIEW_PRE)

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label={TEXT.tabs.script} options={SCRIPT_VIEWS} value={view} onChange={setView} />
      </Toolbar>
      <Notice>{TEXT.scriptNote}</Notice>
      <ScriptEditor
        key={view}
        value={settings[view]}
        path={`${path}/${view}`}
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
        <Textarea
          value={description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder={TEXT.docsPlaceholder}
          rows={14}
          aria-label={TEXT.tabs.docs}
          className="font-sans"
        />
      </PanelBody>
    </Panel>
  )
}

function useFolderAuthActions(backend, scopeId, auth, onChange) {
  const [tokenRequest, setTokenRequest] = useState(null)

  const getToken = async () => {
    if (useAppStore.getState().isRestricted) {
      setTokenRequest({ isPending: false, error: RESTRICTED })
      return
    }
    setTokenRequest({ isPending: true, error: "" })
    try {
      const variables = variableTextFor(useAppStore.getState(), { folderId: scopeId, vars: "" })
      const oauth2 = await obtainToken(backend, auth.oauth2, variables, {})
      onChange({ auth: { ...auth, oauth2 } })
      setTokenRequest(null)
    } catch (error) {
      setTokenRequest({ isPending: false, error: error.message })
    }
  }

  const actions = {
    getToken,
    cancelToken: () => backend.cancelAuthorization(),
    forgetToken: () => onChange({ auth: { ...auth, oauth2: clearToken(auth.oauth2) } }),
    oauthCallback: backend.oauthCallback,
  }
  return { tokenRequest, actions }
}

function AuthTab({ backend, scopeId, auth, source, isCollection, onChange }) {
  const { tokenRequest, actions } = useFolderAuthActions(backend, scopeId, auth, onChange)
  const inheritance = isCollection ? undefined : { source, noAuthValue: NO_AUTH, noAuthNote: TEXT.folderNoAuth }
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
  const parentSource = useAppStore((state) => (
    folder ? inheritedAuthSource({ type: AUTH_INHERIT }, lineageOf(state, folder.parentId))?.name ?? null : null
  ))
  const isCollection = scope.folderId === ROOT_SETTINGS_ID
  const source = isCollection ? collectionSettings : folder
  return { source, folder, isCollection, parentSource }
}

export function FolderSettings({ backend, scope, EditorComponent, onClose }) {
  const [tab, setTab] = useState(TAB_HEADERS)
  const { source, folder, isCollection, parentSource } = useScope(scope)
  const isRestricted = useAppStore((state) => state.isRestricted)
  const update = useAppStore((state) => state.updateScopeSettings)
  const settings = useMemo(() => normalizeScopeSettings(source), [source])
  const patch = (changes) => update(scope.folderId, changes)

  useEffect(() => {
    if (!source) onClose()
  }, [source, onClose])

  if (!source) return null
  const title = isCollection ? TEXT.collectionTitle : TEXT.folderTitle(folder.name)
  const path = `settings/${scope.folderId || "collection"}`

  return (
    <Dialog label={title} size="lg" onClose={onClose}>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader onClose={onClose}>
          <DialogTitle>{title}</DialogTitle>
          <TabsList label={title} className="ml-4">
            {Object.entries(TEXT.tabs).map(([value, label]) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </DialogHeader>
        {isRestricted && hasActiveSettings(settings) && <Notice tone="warning">{TEXT.restrictedNote}</Notice>}
        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent value={TAB_HEADERS} className="h-full min-h-0">
            <Panel>
              <Notice>{TEXT.headersNote}</Notice>
              <KeyValueEditor
                rows={parseRows(settings.headers)}
                onChange={(rows) => patch({ headers: serializeRows(rows) })}
                keyLabel="Header"
              />
            </Panel>
          </TabsContent>
          <TabsContent value={TAB_AUTH} className="h-full min-h-0">
            <AuthTab
              backend={backend}
              scopeId={scope.folderId}
              auth={settings.auth}
              source={parentSource}
              isCollection={isCollection}
              onChange={patch}
            />
          </TabsContent>
          <TabsContent value={TAB_VARS} className="h-full min-h-0">
            {isCollection ? <CollectionVariables /> : <VariablesTab variables={folder.variables} onChange={(variables) => patch({ variables })} />}
          </TabsContent>
          <TabsContent value={TAB_SCRIPT} className="h-full min-h-0">
            <ScriptTab settings={settings} path={path} EditorComponent={EditorComponent} onChange={patch} />
          </TabsContent>
          <TabsContent value={TAB_TESTS} className="h-full min-h-0">
            <Panel>
              <Notice>{TEXT.testsNote}</Notice>
              <AssertionEditor assertions={settings.assertions} onChange={(assertions) => patch({ assertions })} />
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

function CollectionVariables() {
  const collectionVariables = useAppStore((state) => state.collectionVariables)
  const setCollectionVariables = useAppStore((state) => state.setCollectionVariables)
  return <VariablesTab variables={collectionVariables} onChange={setCollectionVariables} />
}
