import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, lazy, Suspense } from "react"
import { AlertTriangle } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { RequestBar } from "./RequestBar"
import { DiskChangeNotice } from "./DiskChangeNotice"
import { ResponsePanel } from "./ResponsePanel"
import { AppDialogs } from "./AppDialogs"
import { AppHeader } from "./AppHeader"
import { NoticeToast } from "./NoticeToast"
import { StatusBar } from "./StatusBar"
import { TabBar } from "./TabBar"
import { RequestTabs } from "./RequestTabs"
import { AppSkeleton } from "./AppSkeleton"
import { Button } from "./ui/button"
import { DialogPending } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { WelcomePanel } from "./WelcomePanel"
import { GettingStartedButton, useOnboardingCompletion } from "./GettingStarted"
import { resolvedVariablesFor, restoreTabDrafts, selectActiveVariables, selectIsDialogOpen, selectResolvedVariables, useActiveTab, useAppStore } from "../store/appStore"
import { useAutoSave } from "../hooks/useAutoSave"
import { useRequestFieldHandlers } from "../hooks/useRequestFieldHandlers"
import { useShortcuts } from "../hooks/useShortcuts"
import { useSharedSecretConnections } from "../hooks/useSecretConnections"
import { useCaptureStore } from "../lib/captureSession"
import { isLoadTestable, useLoadTestStore } from "../lib/loadTestSession"
import { useAiEnabled, useAiStore } from "../lib/ai/session"
import { TASK_EXPLAIN, TASK_REQUEST } from "../lib/ai/tasks"
import { MIN_REQUEST_HEIGHT_PX, isNarrowViewport } from "../lib/layout"
import { isBlankRequest } from "../lib/requestChanges"
import { forgetSharedLink, pendingSharedLink, subscribeToSharedLink } from "../lib/sharedLink"
import { currentOpenLink, dismissOpenLink, subscribeToOpenLink } from "../lib/openLink"
import { exportableVariables, foldersWithoutSecrets, listWithoutSecrets, withoutSecretValues } from "../lib/variableScopes"
import { createWorkspaceActions } from "../lib/workspaceActions"
import { whenIdle } from "../lib/idle"
import { PANE_ADDRESS, PANE_SIDEBAR, cyclePane, focusAddress, focusPane, watchPaneFocus } from "../lib/panes"
import { SIDEBAR_TEXT } from "../lib/sidebarText"
import { DATA_TEXT } from "../lib/dataText"
import { APP_TEXT } from "../lib/appText"
import { WORKSPACE_TEXT } from "../lib/workspaceText"
import { takeDataDeleted } from "../lib/storage"
import { isWebSocketURL } from "../lib/socketUrl"
import { isSocketAddress, selectSession, useSocketStore } from "../lib/socketSessions"

const CodeSnippetDialog = lazy(() => import("./CodeSnippetDialog").then((module) => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./ImportExportDialog").then((module) => ({ default: module.ImportExportDialog })))
const IncomingShareDialog = lazy(() => import("./IncomingShareDialog").then((module) => ({ default: module.IncomingShareDialog })))
const ScanDialog = lazy(() => import("./ScanDialog").then((module) => ({ default: module.ScanDialog })))
const OpenLinkDialog = lazy(() => import("./OpenLinkDialog").then((module) => ({ default: module.OpenLinkDialog })))
const CookiesDialog = lazy(() => import("./CookiesDialog").then((module) => ({ default: module.CookiesDialog })))
const NetworkDialog = lazy(() => import("./NetworkDialog").then((module) => ({ default: module.NetworkDialog })))
const ExamplesDialog = lazy(() => import("./ExamplesDialog").then((module) => ({ default: module.ExamplesDialog })))
const MockServerDialog = lazy(() => import("./MockServerDialog").then((module) => ({ default: module.MockServerDialog })))
const CaptureDialog = lazy(() => import("./CaptureDialog").then((module) => ({ default: module.CaptureDialog })))
const LoadTestDialog = lazy(() => import("./LoadTestDialog").then((module) => ({ default: module.LoadTestDialog })))
const SpecViewer = lazy(() => import("./SpecViewer").then((module) => ({ default: module.SpecViewer })))
const SpecSyncDialog = lazy(() => import("./SpecSyncDialog").then((module) => ({ default: module.SpecSyncDialog })))
const FolderSettings = lazy(() => import("./FolderSettings").then((module) => ({ default: module.FolderSettings })))
const RunnerDialog = lazy(() => import("./RunnerDialog").then((module) => ({ default: module.RunnerDialog })))
const AiDialog = lazy(() => import("./AiDialog").then((module) => ({ default: module.AiDialog })))
const loadCodeEditor = () => import("./CodeEditor")
const CodeEditor = lazy(() => loadCodeEditor().then((module) => ({ default: module.CodeEditor })))

const ENVIRONMENT_SAVE_DELAY_MS = 400

const activeFirst = (environments, activeId) => [
  ...environments.filter((environment) => environment.id === activeId),
  ...environments.filter((environment) => environment.id !== activeId),
]
const REQUEST_AREA_STYLE = { minHeight: MIN_REQUEST_HEIGHT_PX }

const store = () => useAppStore.getState()

function focusSidebarSearch() {
  if (!store().isSidebarOpen) store().toggleSidebar()
  requestAnimationFrame(() => document.querySelector("aside input[type=search]")?.focus())
}

const hasFocusIn = (pane) => Boolean(document.activeElement?.closest(`[data-pane="${pane}"]`))

function returnFocusFromClosedSidebar() {
  return useAppStore.subscribe((state, previous) => {
    const isClosing = previous.isSidebarOpen && !state.isSidebarOpen
    if (isClosing && !isNarrowViewport() && hasFocusIn(PANE_SIDEBAR)) focusPane(PANE_ADDRESS)
  })
}

const aiShortcutHandlers = (actions) => ({
  aiGenerate: () => actions.ai.start(TASK_REQUEST),
  aiExplain: () => actions.ai.start(TASK_EXPLAIN),
})

const createShortcutHandlers = (actions, isAiOn) => {
  const handlers = {
    commandPalette: () => store().openCommandPalette(),
    findRequest: () => store().openCommandPalette("requests"),
    shortcutsHelp: () => store().openShortcutsDialog(),
    newRequest: () => actions.newRequest(),
    saveRequest: actions.save,
    sendRequest: actions.send,
    closeTab: () => actions.closeTab(store().activeTabId),
    reopenTab: () => store().reopenClosedTab(),
    closeOtherTabs: () => actions.tabs.closeOthers(store().activeTabId),
    closeSavedTabs: () => actions.tabs.closeSaved(),
    keepTab: () => actions.tabs.pinActive(),
    nextTab: () => store().cycleTab(1),
    previousTab: () => store().cycleTab(-1),
    toggleSidebar: () => store().toggleSidebar(),
    focusSidebarSearch,
    nextPane: () => cyclePane(1),
    previousPane: () => cyclePane(-1),
    focusAddress,
    ...(isAiOn && aiShortcutHandlers(actions)),
  }
  if (actions.storage) {
    handlers.workspaceSwitcher = actions.storage.openSwitcher
    handlers.nextWorkspace = () => actions.storage.cycle(1)
    handlers.previousWorkspace = () => actions.storage.cycle(-1)
  }
  for (let position = 1; position <= 9; position += 1) handlers[`tab${position}`] = () => store().activateTabAt(position)
  return handlers
}

const messageOf = (error) => error?.message || String(error)

const isSocketOnly = (tab) => isWebSocketURL(tab.request.url) && !tab.response

function LoadFailure({ reason, onRetry }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <EmptyState
        icon={AlertTriangle}
        title={APP_TEXT.loadFailure.title}
        description={APP_TEXT.loadFailure.description(reason)}
        action={<Button onClick={onRetry}>{APP_TEXT.loadFailure.retry}</Button>}
      />
    </div>
  )
}

function useStoredData(backend) {
  const isHydrated = useAppStore((s) => s.hydrated)
  const hydrate = useAppStore((s) => s.hydrate)
  const showAlert = useAppStore((s) => s.showAlert)
  const showNotice = useAppStore((s) => s.showNotice)
  const [failure, setFailure] = useState(null)

  useEffect(() => {
    if (isHydrated || failure) return undefined
    let isCurrent = true
    const adopt = (data) => {
      if (!isCurrent) return
      hydrate(data)
      if (data.notice) showAlert(APP_TEXT.loadFailure.unreadable, data.notice, APP_TEXT.loadFailure.ok, "warning")
      if (data.restricted) showNotice(WORKSPACE_TEXT.restrictedOpened)
      if (takeDataDeleted()) showNotice(DATA_TEXT.deleted)
    }
    const fail = (error) => {
      if (isCurrent) setFailure(messageOf(error))
    }
    Promise.all([backend.load(), restoreTabDrafts(backend.tabDrafts)]).then(([data]) => adopt(data)).catch(fail)
    return () => {
      isCurrent = false
    }
  }, [backend, isHydrated, failure, hydrate, showAlert, showNotice])

  const retry = useCallback(() => setFailure(null), [])

  return { isHydrated, failure, retry }
}

function usePersistence(backend) {
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const cookies = useAppStore((s) => s.cookies)
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const activeGlobalEnvironmentId = useAppStore((s) => s.activeGlobalEnvironmentId)
  const collectionVariables = useAppStore((s) => s.collectionVariables)
  const collectionVariablesMeta = useAppStore((s) => s.collectionVariablesMeta)
  const collectionSettings = useAppStore((s) => s.collectionSettings)
  const reportPersistenceFailure = useAppStore((s) => s.reportPersistenceFailure)

  const environmentState = useMemo(
    () => ({ environments, activeEnvironmentId }),
    [environments, activeEnvironmentId]
  )

  const scopeState = useMemo(
    () => ({ globalEnvironments, activeGlobalEnvironmentId, collectionVariables, collectionVariablesMeta }),
    [globalEnvironments, activeGlobalEnvironmentId, collectionVariables, collectionVariablesMeta]
  )

  const persist = useCallback((write) => {
    if (!useAppStore.getState().hydrated) return
    write().catch(reportPersistenceFailure)
  }, [reportPersistenceFailure])

  const saveFolders = useCallback((value) => persist(() => backend.saveFolders(value)), [backend, persist])
  const saveHistory = useCallback((value) => persist(() => backend.saveHistory(value)), [backend, persist])
  const saveCookies = useCallback((value) => persist(() => backend.saveCookies(value)), [backend, persist])
  const saveEnvironments = useCallback(
    (value) => persist(() => backend.saveEnvironments(value.environments, value.activeEnvironmentId)),
    [backend, persist]
  )

  const saveScopes = useCallback(
    (value) => persist(() => backend.saveScopes(value.globalEnvironments, value.activeGlobalEnvironmentId, value.collectionVariables, value.collectionVariablesMeta)),
    [backend, persist]
  )

  const saveCollectionSettings = useCallback((value) => persist(() => backend.saveCollectionSettings(value)), [backend, persist])

  useAutoSave(folders, saveFolders)
  useAutoSave(requestHistory, saveHistory)
  useAutoSave(cookies, saveCookies)
  useAutoSave(environmentState, saveEnvironments, ENVIRONMENT_SAVE_DELAY_MS)
  useAutoSave(scopeState, saveScopes, ENVIRONMENT_SAVE_DELAY_MS)
  useAutoSave(collectionSettings, saveCollectionSettings, ENVIRONMENT_SAVE_DELAY_MS)
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
  const scanDialogOpen = useAppStore((s) => s.scanDialogOpen)
  const closeScanDialog = useAppStore((s) => s.closeScanDialog)
  const settingsDialogOpen = useAppStore((s) => s.settingsDialogOpen)
  const examplesDialogOpen = useAppStore((s) => s.examplesDialogOpen)
  const mockDialogOpen = useAppStore((s) => s.mockDialogOpen)
  const specDialog = useAppStore((s) => s.specDialog)
  const specLinks = useAppStore((s) => s.specLinks)
  const closeSpecDialog = useAppStore((s) => s.closeSpecDialog)
  const settings = useAppStore((s) => s.settings)
  const isRunnerOpen = useAppStore((s) => s.runner.isOpen)
  const folderSettings = useAppStore((s) => s.folderSettings)
  const collectionSettings = useAppStore((s) => s.collectionSettings)
  const sharedOrder = useAppStore((s) => s.sharedOrder)
  const sharedVariables = useAppStore((s) => s.collectionVariables)
  const sharedVariablesMeta = useAppStore((s) => s.collectionVariablesMeta)
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const activeGlobalEnvironmentId = useAppStore((s) => s.activeGlobalEnvironmentId)
  const closeFolderSettings = useAppStore((s) => s.closeFolderSettings)
  const captureDialogOpen = useCaptureStore((s) => s.isOpen)
  const loadTestDialogOpen = useLoadTestStore((s) => s.isOpen)
  const aiDialog = useAiStore((s) => s.dialog !== null)
  const isAiOn = useAiEnabled()
  const isDialogOpen = useAppStore(selectIsDialogOpen) || captureDialogOpen || loadTestDialogOpen || aiDialog
  const sharedLink = useSyncExternalStore(subscribeToSharedLink, pendingSharedLink)
  const openLink = useSyncExternalStore(subscribeToOpenLink, currentOpenLink)

  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const updateActiveRequest = useAppStore((s) => s.updateActiveRequest)
  const setActiveBodyDrafts = useAppStore((s) => s.setActiveBodyDrafts)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)
  const openCookiesDialog = useAppStore((s) => s.openCookiesDialog)
  const closeCookiesDialog = useAppStore((s) => s.closeCookiesDialog)
  const openSettingsDialog = useAppStore((s) => s.openSettingsDialog)
  const closeSettingsDialog = useAppStore((s) => s.closeSettingsDialog)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const welcomeVisible = useAppStore((s) => s.welcomeVisible)
  const hideWelcome = useAppStore((s) => s.hideWelcome)
  const closeWelcome = useAppStore((s) => s.closeWelcome)

  const activeTab = useActiveTab()
  const activeRequest = activeTab.request
  const isSocket = useMemo(() => isSocketAddress(activeRequest.url, variables), [activeRequest.url, variables])
  const socketStatus = useSocketStore((state) => selectSession(activeTab.id)(state).status)
  const isLoading = activeTab.pendingId !== null
  const showsWelcome = welcomeVisible && isBlankRequest(activeRequest) && activeTab.response === null && !isLoading

  useEffect(() => {
    if (welcomeVisible && !showsWelcome) closeWelcome()
  }, [welcomeVisible, showsWelcome, closeWelcome])

  useOnboardingCompletion()

  const actions = useMemo(() => createWorkspaceActions(backend), [backend])
  useSharedSecretConnections(actions.secrets)
  const resolvedVariables = useAppStore(selectResolvedVariables)
  const variablesMap = useMemo(() => exportableVariables(resolvedVariables), [resolvedVariables])
  const variablesFor = useCallback((folderId) => exportableVariables(resolvedVariablesFor(useAppStore.getState(), folderId)), [])
  const shareableEnvironments = useMemo(() => withoutSecretValues(environments), [environments])
  const shareableGlobals = useMemo(
    () => withoutSecretValues(activeFirst(globalEnvironments, activeGlobalEnvironmentId)),
    [globalEnvironments, activeGlobalEnvironmentId]
  )
  const shareableFolders = useMemo(() => foldersWithoutSecrets(folders), [folders])
  const shareableVariables = useMemo(
    () => ({ variables: listWithoutSecrets(sharedVariables, sharedVariablesMeta), meta: sharedVariablesMeta }),
    [sharedVariables, sharedVariablesMeta]
  )
  const openNewTab = useCallback(() => actions.newRequest(), [actions])
  const disconnectSocket = useCallback(() => actions.sockets.disconnect(activeTab.id), [actions, activeTab.id])
  const scannedCollection = useMemo(
    () => ({ requests, folders: shareableFolders, environments: shareableEnvironments, variables: shareableVariables.variables, settings: collectionSettings }),
    [requests, shareableFolders, shareableEnvironments, shareableVariables, collectionSettings]
  )
  const goToRequest = useCallback((requestId) => {
    closeScanDialog()
    closeImportDialog()
    actions.goToRequest(requestId)
  }, [actions, closeScanDialog, closeImportDialog])

  const updateField = useCallback((field, value) => updateActiveRequest({ [field]: value }), [updateActiveRequest])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  const shortcuts = useMemo(() => createShortcutHandlers(actions, isAiOn), [actions, isAiOn])

  useShortcuts(shortcuts, !isDialogOpen && !sharedLink && !openLink)
  useEffect(watchPaneFocus, [])
  useEffect(returnFocusFromClosedSidebar, [])
  usePersistence(backend)
  useEffect(() => actions.storage?.followDisk(), [actions])
  useEffect(() => {
    actions.mock.resume()
    actions.capture.resume()
  }, [actions])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        storage={actions.storage}
        windowFrame={backend.windowFrame}
        onImport={actions.openImport}
        onOpenCommands={openCommandPalette}
        onToggleSidebar={() => actions.runCommand("toggleSidebar")}
        onOpenCookies={openCookiesDialog}
        onOpenSettings={openSettingsDialog}
        onOpenMock={actions.mock.open}
        onOpenCapture={actions.capture.open}
        onBack={onBack}
        gettingStarted={showsWelcome ? null : <GettingStartedButton onBegin={actions.beginOnboardingStep} />}
      />

      <div className="relative flex min-h-0 flex-1">
        {isSidebarOpen && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label={SIDEBAR_TEXT.close}
              onClick={() => actions.runCommand("toggleSidebar")}
              className="absolute inset-0 z-20 bg-black/40 md:hidden"
            />
            <Sidebar
              folders={folders}
              requests={requests}
              requestHistory={requestHistory}
              activeRequestId={activeRequest.id}
              actions={actions}
            />
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            requests={requests}
            actions={actions}
            onTabSelect={setActiveTab}
            onTabClose={actions.closeTab}
            onNewTab={openNewTab}
          />

          <DiskChangeNotice />

          <RequestBar
            activeRequest={activeRequest}
            {...fieldHandlers}
            onSend={actions.send}
            onCancel={actions.cancel}
            onSave={actions.save}
            onGenerateCode={actions.generateCode}
            onLoadTest={actions.loadTest.isAvailable && isLoadTestable(activeRequest) ? actions.loadTest.open : null}
            onPasteCurl={actions.pasteCurl}
            onDisconnect={disconnectSocket}
            socketStatus={isSocket ? socketStatus : null}
            loading={isLoading}
          />

          {showsWelcome ? <WelcomePanel actions={actions} onDismiss={hideWelcome} /> : <div className="response-split flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <section aria-label={APP_TEXT.requestSection} data-pane="request" className="flex min-h-0 flex-1 flex-col" style={REQUEST_AREA_STYLE}>
              <RequestTabs
                tabId={activeTab.id}
                activeRequest={activeRequest}
                bodyDrafts={activeTab.bodyDrafts}
                onUpdateRequest={updateActiveRequest}
                onBodyDraftsChange={setActiveBodyDrafts}
                variables={variables}
                response={activeTab.response}
                extraction={activeTab.extraction}
                tokenRequest={activeTab.tokenRequest}
                schema={activeTab.schema}
                grpcSchema={activeTab.grpcSchema}
                mcpCatalog={activeTab.mcpCatalog}
                actions={actions}
                EditorComponent={CodeEditor}
              />
            </section>

            {!isSocketOnly(activeTab) && <ResponsePanel
              response={activeTab.response}
              history={activeTab.responses}
              tests={activeTab.tests}
              loading={isLoading}
              onDownload={actions.download}
              onSaveExample={actions.examples.saveResponse}
              onExplain={isAiOn ? () => actions.ai.start(TASK_EXPLAIN) : null}
              onTrust={actions.storage?.confirmTrust}
            />}
          </div>}
        </main>
      </div>

      <Suspense fallback={<DialogPending />}>
        {codeDialogOpen && codeSnippets && (
          <CodeSnippetDialog snippets={codeSnippets} onClose={closeCodeDialog} />
        )}
        {importDialogOpen && (
          <ImportExportDialog
            initialTab={importDialogTab}
            shareFolderId={importDialogFolderId}
            shareLinkBase={actions.shareLinkBase}
            requests={requests}
            folders={shareableFolders}
            environments={shareableEnvironments}
            globals={shareableGlobals}
            collectionVariables={shareableVariables}
            variables={variablesMap}
            variablesFor={variablesFor}
            settings={collectionSettings}
            sharedOrder={sharedOrder}
            onImport={actions.importData}
            onImportShared={actions.importShared}
            openapi={actions.openapi}
            importer={actions.importer}
            scan={actions.scan}
            onGoToRequest={goToRequest}
            onSaveBase64={actions.saveBase64File}
            onPickSpecFile={actions.canConfigureNetwork ? actions.pickFile : null}
            onSaveFile={actions.saveTextFile}
            onClose={closeImportDialog}
          />
        )}
        {sharedLink && <IncomingShareDialog reference={sharedLink} onImport={actions.importShared} onClose={forgetSharedLink} />}
        {openLink && (
          <OpenLinkDialog link={openLink} fetchLink={backend.fetchLink} importer={actions.importer} onImport={actions.importShared} onClose={dismissOpenLink} />
        )}
        {cookiesDialogOpen && <CookiesDialog onClose={closeCookiesDialog} />}
        {scanDialogOpen && <ScanDialog scan={actions.scan} collection={scannedCollection} onGoToRequest={goToRequest} onClose={closeScanDialog} />}
        {settingsDialogOpen && <NetworkDialog settings={settings} actions={actions} onClose={closeSettingsDialog} />}
        {examplesDialogOpen && <ExamplesDialog request={activeRequest} actions={actions.examples} EditorComponent={CodeEditor} />}
        {mockDialogOpen && <MockServerDialog folders={folders} requests={requests} actions={actions.mock} />}
        {captureDialogOpen && <CaptureDialog folders={folders} requests={requests} actions={actions.capture} />}
        {loadTestDialogOpen && <LoadTestDialog actions={actions.loadTest} />}
        {specDialog?.mode === "view" && <SpecViewer dialog={specDialog} actions={actions.openapi} onClose={closeSpecDialog} />}
        {specDialog?.mode === "sync" && <SpecSyncDialog dialog={specDialog} link={specLinks[specDialog.folderId]} actions={actions.openapi} onClose={closeSpecDialog} />}
        {folderSettings && <FolderSettings backend={backend} scope={folderSettings} EditorComponent={CodeEditor} onClose={closeFolderSettings} />}
        {aiDialog && <AiDialog actions={actions.ai} />}
        {isRunnerOpen && <RunnerDialog folders={folders} requests={requests} actions={actions} />}
      </Suspense>

      <StatusBar
        onOpenMock={actions.mock.open}
        onOpenCapture={actions.capture.open}
        updates={backend.updates}
        remindsExport={actions.backups?.remindsExport}
        onExport={() => actions.runCommand("export")}
      />

      <NoticeToast />

      <AppDialogs onCommand={actions.runCommand} secrets={actions.secrets} listFonts={backend.listInstalledFonts} windowFrame={backend.windowFrame} hasWorkspaces={Boolean(actions.storage)} hasLoadTest={actions.loadTest.isAvailable} isAiOn={isAiOn} ai={actions.ai} backups={actions.backups} relay={backend.relay} updates={backend.updates} />
    </div>
  )
}

export function Workspace({ backend, onBack }) {
  const { isHydrated, failure, retry } = useStoredData(backend)
  useEffect(() => whenIdle(loadCodeEditor), [])
  if (failure) return <LoadFailure reason={failure} onRetry={retry} />
  if (!isHydrated) return <AppSkeleton />
  return <LoadedWorkspace backend={backend} onBack={onBack} />
}
