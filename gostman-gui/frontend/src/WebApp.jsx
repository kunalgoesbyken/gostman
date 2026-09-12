import { useEffect, useCallback, useMemo, lazy, Suspense } from "react"
import { LandingPage } from "./components/LandingPage"
import { Sidebar } from "./components/Sidebar"
import { RequestBar } from "./components/RequestBar"
import { ResponsePanel } from "./components/ResponsePanel"
import { AppDialogs } from "./components/AppDialogs"
import { AppHeader } from "./components/AppHeader"
const MonacoEditor = lazy(() => import("./components/MonacoEditor").then(module => ({ default: module.MonacoEditor })))
import { Loader2 } from "lucide-react"
import { RequestTabs } from "./components/RequestTabs"
import { TabBar } from "./components/TabBar"
const CodeSnippetDialog = lazy(() => import("./components/CodeSnippetDialog").then(module => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./components/ImportExportDialog").then(module => ({ default: module.ImportExportDialog })))
import { parseVariables } from "./lib/variables"
import { prepareRequest } from "./lib/requestUtils"
import { sendProxyRequest } from "./lib/api"
import { mockRequests, mockFolders } from "./lib/mockData"
import { loadState, saveState, resetState, KEYS } from "./lib/storage"
import { useAppStore, useActiveTab } from "./store/appStore"
import { useDialogActions } from "./hooks/useDialogActions"
import { useRequestFieldHandlers } from "./hooks/useRequestFieldHandlers"
import { useRoute } from "./hooks/useRoute"
import { useClearHistoryHandler, useCommandHandler, useCreateFolderHandler, useGenerateCodeHandler, useSaveVarsHandler } from "./hooks/useSharedHandlers"
import { parseJSON } from "./lib/dataUtils"

// Web variables are already auto-saved by the localStorage effect below, so
// this only supplies the success message for the shared save-vars flow.
const persistVariables = async () => 'Variables saved!'

function WebApp() {
  const { route, navigate } = useRoute()
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const variables = useAppStore((s) => s.variables)
  const variablesMap = useMemo(() => parseJSON(variables, {}), [variables])
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const codeDialogOpen = useAppStore((s) => s.codeDialogOpen)
  const codeSnippets = useAppStore((s) => s.codeSnippets)
  const importDialogOpen = useAppStore((s) => s.importDialogOpen)
  const activeRequestTab = useAppStore((s) => s.activeRequestTab)

  const setRequests = useAppStore((s) => s.setRequests)
  const setFolders = useAppStore((s) => s.setFolders)
  const setRequestHistory = useAppStore((s) => s.setRequestHistory)
  const setVariables = useAppStore((s) => s.setVariables)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const newTab = useAppStore((s) => s.newTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const updateActiveTab = useAppStore((s) => s.updateActiveTab)
  const updateActiveRequest = useAppStore((s) => s.updateActiveRequest)
  const loadRequestIntoTab = useAppStore((s) => s.loadRequestIntoTab)
  const loadHistoryIntoTab = useAppStore((s) => s.loadHistoryIntoTab)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const openImportDialog = useAppStore((s) => s.openImportDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)
  const deleteFolder = useAppStore((s) => s.deleteFolder)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const addToHistory = useAppStore((s) => s.addToHistory)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)

  const { showAlert, showConfirm, openCommandPalette } = useDialogActions()

  const activeTab = useActiveTab()
  const activeRequest = activeTab?.request || {}

  useEffect(() => {
    setRequests(loadState(KEYS.REQUESTS, mockRequests))
    setFolders(loadState(KEYS.FOLDERS, mockFolders))
    setRequestHistory(loadState(KEYS.HISTORY, []))
    setVariables(loadState(KEYS.VARS, "{}"))
  }, [])

  // Declared before the field handlers that close over it: moving it later
  // reintroduces a TDZ crash (see commit 80c683a).
  const updateField = useCallback((field, value) => {
    updateActiveRequest({ [field]: value })
  }, [])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  useEffect(() => {
    saveState(KEYS.REQUESTS, requests)
    saveState(KEYS.FOLDERS, folders)
    saveState(KEYS.HISTORY, requestHistory)
    saveState(KEYS.VARS, variables)
  }, [requests, folders, requestHistory, variables])

  const handleCreateFolder = useCreateFolderHandler()
  const handleClearHistory = useClearHistoryHandler()
  const handleGenerateCode = useGenerateCodeHandler(activeRequest, variablesMap)
  const handleSaveVars = useSaveVarsHandler(variables, persistVariables)

  const handleDeleteFolder = useCallback((folderId) => {
    showConfirm(
      'Delete Folder',
      'Move requests to root?',
      () => {
        setRequests(requests.map(r => r.folderId === folderId ? { ...r, folderId: null } : r))
        deleteFolder(folderId)
      },
      null,
      'default'
    )
  }, [requests])

  const handleSave = useCallback(async () => {
    const saved = { ...activeRequest, id: activeRequest.id || crypto.randomUUID() }

    setRequests(activeRequest.id
      ? requests.map(r => r.id === activeRequest.id ? saved : r)
      : [...requests, saved])
    updateActiveRequest({ id: saved.id })
    showAlert('Success', 'Request saved!', 'OK', 'success')
  }, [activeRequest, requests])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    showConfirm(
      'Delete Request',
      'Can\'t be undone.',
      () => {
        setRequests(requests.filter(r => r.id !== id))
        newTab()
      },
      null,
      'destructive'
    )
  }, [requests])

  const handleSend = useCallback(async () => {
    updateActiveTab({ loading: true, status: 'Sending...', responseTime: null })
    const startTime = performance.now()

    const getResponseTime = () => Math.round(performance.now() - startTime)

    let prepared
    try {
      prepared = prepareRequest(activeRequest, parseVariables(variables))
    } catch (e) {
      updateActiveRequest({ response: e.message })
      updateActiveTab({
        status: 'Error',
        responseTime: null,
        loading: false,
        responseHeaders: null,
        responseCookies: null,
        responseSize: null
      })
      return
    }

    try {
      // Proxy returns JSON: {status, headers: [{key, value}], body, cookies, size}
      const response = await sendProxyRequest(prepared)
      const proxyResponse = await response.json()

      updateActiveRequest({ response: proxyResponse.body || '' })
      updateActiveTab({
        status: proxyResponse.status || 'Error',
        responseTime: getResponseTime(),
        loading: false,
        responseHeaders: proxyResponse.headers || null,
        responseCookies: proxyResponse.cookies || null,
        responseSize: proxyResponse.size ?? null
      })
    } catch (e) {
      updateActiveRequest({ response: `Error: ${e.message}` })
      updateActiveTab({
        status: 'Error',
        responseTime: getResponseTime(),
        loading: false,
        responseHeaders: null,
        responseCookies: null,
        responseSize: null
      })
    }

    addToHistory(activeRequest)
  }, [activeRequest, variables])

  const handleImport = useCallback((importData) => {
    try {
      if (!importData) return

      let count = 0
      if (importData.requests && Array.isArray(importData.requests)) {
        setRequests(prev => {
          const byId = new Map(prev.map(r => [r.id, r]))
          for (const req of importData.requests) {
            byId.set(req.id, req)
            count++
          }
          return Array.from(byId.values())
        })
      }
      if (importData.folders && Array.isArray(importData.folders)) {
        setFolders(prev => {
          const byId = new Map(prev.map(f => [f.id, f]))
          for (const folder of importData.folders) {
            byId.set(folder.id, folder)
          }
          return Array.from(byId.values())
        })
      }
      if (importData.variables && typeof importData.variables === 'object') {
        setVariables(JSON.stringify(importData.variables, null, 2))
      }
      showAlert('Import Complete', `Imported ${count} requests`)
    } catch (e) {
      showAlert('Import Error', e.message || 'Failed to import')
    }
  }, [])

  const handleGetStarted = useCallback(() => navigate("/web"), [navigate])

  const handleBackToLanding = useCallback(() => navigate("/"), [navigate])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        newTab()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [newTab, openCommandPalette])

  const handleReset = useCallback((message = 'Clear all data?', successMessage = 'Cleared!') => {
    showConfirm(
      'Reset App',
      message,
      () => {
        try {
          resetState()
          showAlert('Success', successMessage, 'OK', 'success')
        } catch (e) {
          console.warn('Reset error:', e)
          showAlert('Reset Error', 'Could not clear all data')
        }
      },
      null,
      'destructive'
    )
  }, [])

  const handleCommandReset = useCallback((message) => {
    handleReset(message, 'Application state cleared.')
  }, [handleReset])

  const handleHeaderReset = useCallback(() => handleReset(), [handleReset])

  const handleCommand = useCommandHandler({
    onNewRequest: newTab,
    onSave: handleSave,
    onCreateFolder: handleCreateFolder,
    onReset: handleCommandReset
  })

  if (route === "/") {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        className="border-b py-3"
        onImport={openImportDialog}
        onReset={handleHeaderReset}
        onBack={handleBackToLanding}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          requests={requests}
          folders={folders}
          requestHistory={requestHistory}
          activeRequest={activeRequest}
          onSelectRequest={loadRequestIntoTab}
          onSelectHistoryItem={loadHistoryIntoTab}
          onDeleteHistoryItem={deleteHistoryItem}
          onClearHistory={handleClearHistory}
          onNewRequest={newTab}
          onDeleteRequest={handleDelete}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onToggleFolder={toggleFolder}
          onNewRequestInFolder={newTab}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onNewTab={newTab}
          />

          <RequestBar
            activeRequest={activeRequest}
            {...fieldHandlers}
            onSend={handleSend}
            onSave={handleSave}
            onGenerateCode={handleGenerateCode}
            loading={activeTab?.loading || false}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <RequestTabs
              activeRequest={activeRequest}
              onUpdateField={updateField}
              variables={variables}
              onUpdateVariables={setVariables}
              onSaveVars={handleSaveVars}
              response={activeRequest.response || ''}
              responseStatus={activeTab?.status || ''}
              responseHeaders={activeTab?.responseHeaders || null}
              EditorComponent={MonacoEditor}
              defaultTab={activeRequestTab || 'body'}
            />

            <ResponsePanel
              response={activeRequest.response || ''}
              status={activeTab?.status || ''}
              responseTime={activeTab?.responseTime}
              responseHeaders={activeTab?.responseHeaders || null}
              responseCookies={activeTab?.responseCookies || null}
              responseSize={activeTab?.responseSize || null}
            />
          </div>
        </div>

        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          {codeDialogOpen && codeSnippets && (
            <CodeSnippetDialog
              snippets={codeSnippets}
              onClose={closeCodeDialog}
            />
          )}
        </Suspense>

        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          {importDialogOpen && (
            <ImportExportDialog
              requests={requests}
              folders={folders}
              variables={variablesMap}
              onImport={handleImport}
              onClose={closeImportDialog}
            />
          )}
        </Suspense>

        <AppDialogs onCommand={handleCommand} />
      </div>
    </div>
  )
}

export default WebApp
