import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, lazy, Suspense } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { RequestBar } from "./RequestBar"
import { ResponsePanel } from "./ResponsePanel"
import { AppDialogs } from "./AppDialogs"
import { AppHeader } from "./AppHeader"
import { StatusBar } from "./StatusBar"
import { TabBar } from "./TabBar"
import { RequestTabs } from "./RequestTabs"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { selectActiveVariables, selectIsDialogOpen, useActiveTab, useAppStore } from "../store/appStore"
import { useAutoSave } from "../hooks/useAutoSave"
import { useRequestFieldHandlers } from "../hooks/useRequestFieldHandlers"
import { useShortcuts } from "../hooks/useShortcuts"
import { useCaptureStore } from "../lib/captureSession"
import { parseJSON } from "../lib/dataUtils"
import { MIN_REQUEST_HEIGHT_PX } from "../lib/layout"
import { forgetSharedLink, pendingSharedLink, subscribeToSharedLink } from "../lib/sharedLink"
import { createWorkspaceActions } from "../lib/workspaceActions"

const CodeSnippetDialog = lazy(() => import("./CodeSnippetDialog").then((module) => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./ImportExportDialog").then((module) => ({ default: module.ImportExportDialog })))
const IncomingShareDialog = lazy(() => import("./IncomingShareDialog").then((module) => ({ default: module.IncomingShareDialog })))
const CookiesDialog = lazy(() => import("./CookiesDialog").then((module) => ({ default: module.CookiesDialog })))
const NetworkDialog = lazy(() => import("./NetworkDialog").then((module) => ({ default: module.NetworkDialog })))
const ExamplesDialog = lazy(() => import("./ExamplesDialog").then((module) => ({ default: module.ExamplesDialog })))
const MockServerDialog = lazy(() => import("./MockServerDialog").then((module) => ({ default: module.MockServerDialog })))
const CaptureDialog = lazy(() => import("./CaptureDialog").then((module) => ({ default: module.CaptureDialog })))
const RunnerDialog = lazy(() => import("./RunnerDialog").then((module) => ({ default: module.RunnerDialog })))
const MonacoEditor = lazy(() => import("./MonacoEditor").then((module) => ({ default: module.MonacoEditor })))

const ENVIRONMENT_SAVE_DELAY_MS = 400
const REQUEST_AREA_STYLE = { minHeight: MIN_REQUEST_HEIGHT_PX }

const store = () => useAppStore.getState()

function focusSidebarSearch() {
  if (!store().isSidebarOpen) store().toggleSidebar()
  requestAnimationFrame(() => document.querySelector("aside input[type=search]")?.focus())
}

// Shortcut ids come from lib/shortcuts.
const createShortcutHandlers = (actions) => {
  const handlers = {
    commandPalette: () => store().openCommandPalette(),
    findRequest: () => store().openCommandPalette("requests"),
    shortcutsHelp: () => store().openShortcutsDialog(),
    newRequest: () => store().newTab(),
    saveRequest: actions.save,
    sendRequest: actions.send,
    closeTab: () => actions.closeTab(store().activeTabId),
    reopenTab: () => store().reopenClosedTab(),
    nextTab: () => store().cycleTab(1),
    previousTab: () => store().cycleTab(-1),
    toggleSidebar: () => store().toggleSidebar(),
    focusSidebarSearch,
  }
  for (let position = 1; position <= 9; position += 1) handlers[`tab${position}`] = () => store().activateTabAt(position)
  return handlers
}

const messageOf = (error) => error?.message || String(error)

function LoadingOverlay() {
  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function LoadFailure({ reason, onRetry }) {
  return (
    <div className="h-screen overflow-y-auto bg-background">
      <EmptyState
        icon={AlertTriangle}
        title="Saved data could not be loaded"
        description={`Nothing was changed or overwritten. ${reason}`}
        action={<Button onClick={onRetry}>Try again</Button>}
      />
    </div>
  )
}

function useStoredData(backend) {
  const isHydrated = useAppStore((s) => s.hydrated)
  const hydrate = useAppStore((s) => s.hydrate)
  const showAlert = useAppStore((s) => s.showAlert)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    if (isHydrated || failure) return undefined
    let isCurrent = true
    const adopt = (data) => {
      if (!isCurrent) return
      hydrate(data)
      if (data.notice) showAlert("Saved data was unreadable", data.notice, "OK", "warning")
    }
    const fail = (error) => {
      if (isCurrent) setFailure(messageOf(error))
    }
    backend.load().then(adopt).catch(fail)
    return () => {
      isCurrent = false
    }
  }, [backend, isHydrated, failure, hydrate, showAlert])

  const retry = useCallback(() => setFailure(null), [])

  return { isHydrated, failure, retry }
}

function usePersistence(backend) {
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const cookies = useAppStore((s) => s.cookies)
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const reportPersistenceFailure = useAppStore((s) => s.reportPersistenceFailure)

  const environmentState = useMemo(
    () => ({ environments, activeEnvironmentId }),
    [environments, activeEnvironmentId]
  )

  const persist = useCallback((write) => {
    if (!useAppStore.getState().hydrated) return
    write().catch((error) => reportPersistenceFailure(messageOf(error)))
  }, [reportPersistenceFailure])

  const saveFolders = useCallback((value) => persist(() => backend.saveFolders(value)), [backend, persist])
  const saveHistory = useCallback((value) => persist(() => backend.saveHistory(value)), [backend, persist])
  const saveCookies = useCallback((value) => persist(() => backend.saveCookies(value)), [backend, persist])
  const saveEnvironments = useCallback(
    (value) => persist(() => backend.saveEnvironments(value.environments, value.activeEnvironmentId)),
    [backend, persist]
  )

  useAutoSave(folders, saveFolders)
  useAutoSave(requestHistory, saveHistory)
  useAutoSave(cookies, saveCookies)
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
  const importDialogFolderId = useAppStore((s) => s.importDialogFolderId)
  const cookiesDialogOpen = useAppStore((s) => s.cookiesDialogOpen)
  const settingsDialogOpen = useAppStore((s) => s.settingsDialogOpen)
  const examplesDialogOpen = useAppStore((s) => s.examplesDialogOpen)
  const mockDialogOpen = useAppStore((s) => s.mockDialogOpen)
  const settings = useAppStore((s) => s.settings)
  const runner = useAppStore((s) => s.runner)
  const captureDialogOpen = useCaptureStore((s) => s.isOpen)
  const isDialogOpen = useAppStore(selectIsDialogOpen) || captureDialogOpen
  const sharedLink = useSyncExternalStore(subscribeToSharedLink, pendingSharedLink)

  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const newTab = useAppStore((s) => s.newTab)
  const updateActiveRequest = useAppStore((s) => s.updateActiveRequest)
  const setActiveBodyDrafts = useAppStore((s) => s.setActiveBodyDrafts)
  const setActiveVariables = useAppStore((s) => s.setActiveVariables)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)
  const openCookiesDialog = useAppStore((s) => s.openCookiesDialog)
  const closeCookiesDialog = useAppStore((s) => s.closeCookiesDialog)
  const openSettingsDialog = useAppStore((s) => s.openSettingsDialog)
  const closeSettingsDialog = useAppStore((s) => s.closeSettingsDialog)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)

  const activeTab = useActiveTab()
  const activeRequest = activeTab.request
  const isLoading = activeTab.pendingId !== null

  const actions = useMemo(() => createWorkspaceActions(backend), [backend])
  const variablesMap = useMemo(() => parseJSON(variables, {}), [variables])
  const openNewTab = useCallback(() => newTab(), [newTab])

  const updateField = useCallback((field, value) => updateActiveRequest({ [field]: value }), [updateActiveRequest])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  const shortcuts = useMemo(() => createShortcutHandlers(actions), [actions])

  useShortcuts(shortcuts, !isDialogOpen && !sharedLink)
  usePersistence(backend)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        storage={actions.storage}
        onImport={actions.openImport}
        onReset={actions.reset}
        onOpenCommands={openCommandPalette}
        onOpenCookies={openCookiesDialog}
        onOpenSettings={openSettingsDialog}
        onOpenMock={actions.mock.open}
        onOpenCapture={actions.capture.open}
        onBack={onBack}
      />

      <div className="flex min-h-0 flex-1">
        {isSidebarOpen && (
          <Sidebar
            folders={folders}
            requests={requests}
            requestHistory={requestHistory}
            activeRequestId={activeRequest.id}
            actions={actions}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col">
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

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <section aria-label="Request" className="flex min-h-0 flex-1 flex-col" style={REQUEST_AREA_STYLE}>
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
                tokenRequest={activeTab.tokenRequest}
                schema={activeTab.schema}
                grpcSchema={activeTab.grpcSchema}
                mcpCatalog={activeTab.mcpCatalog}
                actions={actions}
                EditorComponent={MonacoEditor}
              />
            </section>

            <ResponsePanel
              response={activeTab.response}
              tests={activeTab.tests}
              loading={isLoading}
              onDownload={actions.download}
              onSaveExample={actions.examples.saveResponse}
            />
          </div>
        </main>
      </div>

      <Suspense fallback={<LoadingOverlay />}>
        {codeDialogOpen && codeSnippets && (
          <CodeSnippetDialog snippets={codeSnippets} onClose={closeCodeDialog} />
        )}
        {importDialogOpen && (
          <ImportExportDialog
            initialTab={importDialogTab}
            shareFolderId={importDialogFolderId}
            shareLinkBase={actions.shareLinkBase}
            requests={requests}
            folders={folders}
            environments={environments}
            variables={variablesMap}
            onImport={actions.importData}
            onImportShared={actions.importShared}
            onSaveFile={actions.saveTextFile}
            onClose={closeImportDialog}
          />
        )}
        {sharedLink && <IncomingShareDialog reference={sharedLink} onImport={actions.importShared} onClose={forgetSharedLink} />}
        {cookiesDialogOpen && <CookiesDialog onClose={closeCookiesDialog} />}
        {settingsDialogOpen && <NetworkDialog settings={settings} actions={actions} onClose={closeSettingsDialog} />}
        {examplesDialogOpen && <ExamplesDialog request={activeRequest} actions={actions.examples} EditorComponent={MonacoEditor} />}
        {mockDialogOpen && <MockServerDialog folders={folders} requests={requests} actions={actions.mock} />}
        {captureDialogOpen && <CaptureDialog folders={folders} requests={requests} actions={actions.capture} />}
        {runner.isOpen && <RunnerDialog runner={runner} folders={folders} requests={requests} actions={actions} />}
      </Suspense>

      <StatusBar onOpenMock={actions.mock.open} onOpenCapture={actions.capture.open} />

      <AppDialogs onCommand={actions.runCommand} />
    </div>
  )
}

export function Workspace({ backend, onBack }) {
  const { isHydrated, failure, retry } = useStoredData(backend)
  if (failure) return <LoadFailure reason={failure} onRetry={retry} />
  if (!isHydrated) return <LoadingOverlay />
  return <LoadedWorkspace backend={backend} onBack={onBack} />
}
