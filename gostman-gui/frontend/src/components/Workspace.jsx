import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react"
import { Loader2 } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { RequestBar } from "./RequestBar"
import { ResponsePanel } from "./ResponsePanel"
import { AppDialogs } from "./AppDialogs"
import { AppHeader } from "./AppHeader"
import { TabBar } from "./TabBar"
import { RequestTabs } from "./RequestTabs"
import { selectActiveVariables, selectIsDialogOpen, useActiveTab, useAppStore } from "../store/appStore"
import { useAutoSave } from "../hooks/useAutoSave"
import { useRequestFieldHandlers } from "../hooks/useRequestFieldHandlers"
import { useShortcuts } from "../hooks/useShortcuts"
import { parseJSON } from "../lib/dataUtils"
import { createWorkspaceActions } from "../lib/workspaceActions"

const CodeSnippetDialog = lazy(() => import("./CodeSnippetDialog").then((module) => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./ImportExportDialog").then((module) => ({ default: module.ImportExportDialog })))
const MonacoEditor = lazy(() => import("./MonacoEditor").then((module) => ({ default: module.MonacoEditor })))

const ENVIRONMENT_SAVE_DELAY_MS = 400

const messageOf = (error) => error?.message || String(error)

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function useStoredData(backend) {
  const [ready, setReady] = useState(false)
  const hydrate = useAppStore((s) => s.hydrate)
  const showAlert = useAppStore((s) => s.showAlert)

  useEffect(() => {
    let isCurrent = true
    const finish = (data) => {
      if (!isCurrent) return
      hydrate(data)
      setReady(true)
    }
    backend.load().then(finish).catch((error) => {
      finish({})
      showAlert("Could not load saved data", messageOf(error), "OK", "warning")
    })
    return () => {
      isCurrent = false
    }
  }, [backend, hydrate, showAlert])

  return ready
}

function usePersistence(backend) {
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const reportPersistenceFailure = useAppStore((s) => s.reportPersistenceFailure)

  const environmentState = useMemo(
    () => ({ environments, activeEnvironmentId }),
    [environments, activeEnvironmentId]
  )

  const reportFailure = useCallback(
    (error) => reportPersistenceFailure(messageOf(error)),
    [reportPersistenceFailure]
  )
  const saveFolders = useCallback(
    (value) => backend.saveFolders(value).catch(reportFailure),
    [backend, reportFailure]
  )
  const saveHistory = useCallback(
    (value) => backend.saveHistory(value).catch(reportFailure),
    [backend, reportFailure]
  )
  const saveEnvironments = useCallback(
    (value) => backend.saveEnvironments(value.environments, value.activeEnvironmentId).catch(reportFailure),
    [backend, reportFailure]
  )

  useAutoSave(folders, saveFolders)
  useAutoSave(requestHistory, saveHistory)
  useAutoSave(environmentState, saveEnvironments, ENVIRONMENT_SAVE_DELAY_MS)
}

function LoadedWorkspace({ backend, onBack }) {
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const environments = useAppStore((s) => s.environments)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const variables = useAppStore(selectActiveVariables)
  const codeDialogOpen = useAppStore((s) => s.codeDialogOpen)
  const codeSnippets = useAppStore((s) => s.codeSnippets)
  const importDialogOpen = useAppStore((s) => s.importDialogOpen)
  const importDialogTab = useAppStore((s) => s.importDialogTab)
  const isDialogOpen = useAppStore(selectIsDialogOpen)

  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const newTab = useAppStore((s) => s.newTab)
  const updateActiveRequest = useAppStore((s) => s.updateActiveRequest)
  const setActiveBodyDrafts = useAppStore((s) => s.setActiveBodyDrafts)
  const setActiveVariables = useAppStore((s) => s.setActiveVariables)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)

  const activeTab = useActiveTab()
  const activeRequest = activeTab.request
  const isLoading = activeTab.pendingId !== null

  const actions = useMemo(() => createWorkspaceActions(backend), [backend])
  const variablesMap = useMemo(() => parseJSON(variables, {}), [variables])
  const openNewTab = useCallback(() => newTab(), [newTab])

  const updateField = useCallback((field, value) => updateActiveRequest({ [field]: value }), [updateActiveRequest])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  const shortcuts = useMemo(() => new Map([
    ["k", openCommandPalette],
    ["n", openNewTab],
    ["s", actions.save],
    ["enter", actions.send],
  ]), [openCommandPalette, openNewTab, actions])

  useShortcuts(shortcuts, !isDialogOpen)
  usePersistence(backend)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader onImport={actions.openImport} onReset={actions.reset} onBack={onBack} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          requests={requests}
          requestHistory={requestHistory}
          activeRequestId={activeRequest.id}
          actions={actions}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            requests={requests}
            onTabSelect={setActiveTab}
            onTabClose={actions.closeTab}
            onNewTab={openNewTab}
          />

          <RequestBar
            activeRequest={activeRequest}
            {...fieldHandlers}
            onSend={actions.send}
            onCancel={actions.cancel}
            onSave={actions.save}
            onGenerateCode={actions.generateCode}
            onPasteCurl={actions.pasteCurl}
            loading={isLoading}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <RequestTabs
              tabId={activeTab.id}
              activeRequest={activeRequest}
              bodyDrafts={activeTab.bodyDrafts}
              onUpdateRequest={updateActiveRequest}
              onBodyDraftsChange={setActiveBodyDrafts}
              variables={variables}
              onUpdateVariables={setActiveVariables}
              response={activeTab.response}
              extraction={activeTab.extraction}
              schema={activeTab.schema}
              actions={actions}
              EditorComponent={MonacoEditor}
            />

            <ResponsePanel
              response={activeTab.response}
              loading={isLoading}
              onDownload={actions.download}
            />
          </div>
        </div>
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        {codeDialogOpen && codeSnippets && (
          <CodeSnippetDialog snippets={codeSnippets} onClose={closeCodeDialog} />
        )}
        {importDialogOpen && (
          <ImportExportDialog
            initialTab={importDialogTab}
            requests={requests}
            folders={folders}
            environments={environments}
            variables={variablesMap}
            onImport={actions.importData}
            onSaveFile={actions.saveTextFile}
            onClose={closeImportDialog}
          />
        )}
      </Suspense>

      <AppDialogs onCommand={actions.runCommand} />
    </div>
  )
}

export function Workspace({ backend, onBack }) {
  const ready = useStoredData(backend)
  if (!ready) return <LoadingOverlay />
  return <LoadedWorkspace backend={backend} onBack={onBack} />
}
