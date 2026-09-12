import { useEffect, useCallback, lazy, Suspense } from "react"
import { LandingPage } from "./components/LandingPage"
import { Sidebar } from "./components/Sidebar"
import { RequestBar } from "./components/RequestBar"
import { ResponsePanel } from "./components/ResponsePanel"
import { AppDialogs } from "./components/AppDialogs"
import { AppHeader } from "./components/AppHeader"
const MonacoEditor = lazy(() => import("./components/MonacoEditor").then(module => ({ default: module.MonacoEditor })))
import { Loader2 } from "lucide-react"
import { RequestTabs } from "./components/RequestTabs"
const CodeSnippetDialog = lazy(() => import("./components/CodeSnippetDialog").then(module => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./components/ImportExportDialog").then(module => ({ default: module.ImportExportDialog })))
import { parseVariables } from "./lib/variables"
import { prepareRequest } from "./lib/requestUtils"
import { sendProxyRequest } from "./lib/api"
import { DEFAULT_REQUEST, mockRequests, mockFolders } from "./lib/mockData"
import { loadState, saveState, resetState, KEYS } from "./lib/storage"
import { useAppStore } from "./store/appStore"
import { useDialogActions } from "./hooks/useDialogActions"
import { useRequestFieldHandlers } from "./hooks/useRequestFieldHandlers"
import { useClearHistoryHandler, useCommandHandler, useCreateFolderHandler, useGenerateCodeHandler, useSaveVarsHandler } from "./hooks/useSharedHandlers"
import { parseJSON } from "./lib/dataUtils"

// Web variables are already auto-saved by the localStorage effect below, so
// this only supplies the success message for the shared save-vars flow.
const persistVariables = async () => 'Variables saved!'

function WebApp() {
  const showLanding = useAppStore((s) => s.showLanding)
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const variables = useAppStore((s) => s.variables)
  const status = useAppStore((s) => s.webStatus)
  const loading = useAppStore((s) => s.webLoading)
  const responseTime = useAppStore((s) => s.webResponseTime)
  const codeDialogOpen = useAppStore((s) => s.codeDialogOpen)
  const codeSnippets = useAppStore((s) => s.codeSnippets)
  const importDialogOpen = useAppStore((s) => s.importDialogOpen)
  const activeRequestTab = useAppStore((s) => s.activeRequestTab)

  const setRequests = useAppStore((s) => s.setRequests)
  const setFolders = useAppStore((s) => s.setFolders)
  const setRequestHistory = useAppStore((s) => s.setRequestHistory)
  const setActiveRequest = useAppStore((s) => s.setActiveRequest)
  const setVariables = useAppStore((s) => s.setVariables)
  const setWebStatus = useAppStore((s) => s.setWebStatus)
  const setWebLoading = useAppStore((s) => s.setWebLoading)
  const setWebResponseTime = useAppStore((s) => s.setWebResponseTime)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const openImportDialog = useAppStore((s) => s.openImportDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)
  const setShowLanding = useAppStore((s) => s.setShowLanding)
  const deleteFolder = useAppStore((s) => s.deleteFolder)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const addToHistory = useAppStore((s) => s.addToHistory)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)

  const { showAlert, showConfirm, openCommandPalette } = useDialogActions()

  // Web version uses a single active request rather than tabs.
  const activeRequest = useAppStore((s) => s.activeRequest || DEFAULT_REQUEST)

  useEffect(() => {
    setRequests(loadState(KEYS.REQUESTS, mockRequests))
    setFolders(loadState(KEYS.FOLDERS, mockFolders))
    setRequestHistory(loadState(KEYS.HISTORY, []))
    setVariables(loadState(KEYS.VARS, "{}"))
  }, [])

  // Declared before the field handlers that close over it: moving it later
  // reintroduces a TDZ crash (see commit 80c683a).
  const updateField = useCallback((field, value) => {
    setActiveRequest(prev => ({ ...prev, [field]: value }))
  }, [])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  useEffect(() => {
    saveState(KEYS.REQUESTS, requests)
    saveState(KEYS.FOLDERS, folders)
    saveState(KEYS.HISTORY, requestHistory)
    saveState(KEYS.VARS, variables)
  }, [requests, folders, requestHistory, variables])

  const handleSelectRequest = useCallback((req) => {
    setActiveRequest({
      ...req,
      response: '',
      responseHeaders: null,
      responseCookies: null,
      responseSize: null,
      responseType: 'text'
    })
    setWebStatus("")
    setWebResponseTime(null)
  }, [])

  const handleNewRequest = useCallback((folderId = null) => {
    const newReq = { ...DEFAULT_REQUEST, folderId }
    setActiveRequest(newReq)
    setWebStatus("")
    setWebResponseTime(null)
  }, [])

  const handleCreateFolder = useCreateFolderHandler()
  const handleClearHistory = useClearHistoryHandler()
  const handleGenerateCode = useGenerateCodeHandler(activeRequest)
  const handleSaveVars = useSaveVarsHandler(variables, persistVariables)

  const handleDeleteFolder = useCallback((folderId) => {
    showConfirm(
      'Delete Folder',
      'Move requests to root?',
      () => {
        setRequests(prev => prev.map(r => r.folderId === folderId ? { ...r, folderId: null } : r))
        deleteFolder(folderId)
      },
      null,
      'default'
    )
  }, [])

  const handleToggleFolder = useCallback((folderId) => {
    toggleFolder(folderId)
  }, [])

  const handleSave = useCallback(async () => {
    const newRequest = {
      ...activeRequest,
      id: activeRequest.id || crypto.randomUUID()
    }

    if (activeRequest.id) {
      setRequests(prev => prev.map(r => r.id === activeRequest.id ? newRequest : r))
    } else {
      setRequests(prev => [...prev, newRequest])
    }

    setActiveRequest(newRequest)
    showAlert('Success', 'Request saved!', 'OK', 'success')
  }, [activeRequest])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    showConfirm(
      'Delete Request',
      'Can\'t be undone.',
      () => {
        setRequests(prev => prev.filter(r => r.id !== id))
        if (activeRequest.id === id) {
          setActiveRequest({ ...DEFAULT_REQUEST })
        }
      },
      null,
      'destructive'
    )
  }, [activeRequest, handleNewRequest])

  const handleSelectHistoryItem = useCallback((item) => {
    setActiveRequest({
      ...item,
      id: "",
      name: item.name || "History Request"
    })
    setWebStatus(item.response ? "Loaded from history" : "")
    setWebResponseTime(null)
  }, [])

  const handleSend = useCallback(async () => {
    setWebLoading(true)
    setWebStatus("Sending...")
    setWebResponseTime(null)
    const startTime = performance.now()

    const getResponseTime = () => Math.round(performance.now() - startTime)

    try {
      const varsMap = parseVariables(variables)

      let url, method, headers, body
      try {
        const prepared = prepareRequest(activeRequest, varsMap)
        url = prepared.url
        method = prepared.method
        headers = prepared.headers
        body = prepared.body
      } catch (e) {
        setActiveRequest(prev => ({
          ...prev,
          response: e.message,
        }))
        setWebStatus("Error")
        setWebLoading(false)
        return
      }

      const response = await sendProxyRequest({ method, url, headers, body })
      // Proxy returns JSON: {status, headers: [{key, value}], body, cookies, size}
      const proxyResponse = await response.json()

      const responseData = proxyResponse.body || ''
      const responseHeaders = proxyResponse.headers || []
      const responseCookies = proxyResponse.cookies || null
      const responseSize = (proxyResponse.size != null) ? proxyResponse.size : null
      const statusText = proxyResponse.status || 'Error'

      setWebResponseTime(getResponseTime())
      setActiveRequest(prev => ({
        ...prev,
        response: responseData,
        responseHeaders,
        responseCookies,
        responseSize
      }))
      setWebStatus(statusText)
      addToHistory(activeRequest)
    } catch (e) {
      setWebResponseTime(getResponseTime())
      setActiveRequest(prev => ({
        ...prev,
        response: "Error: " + e.message
      }))
      setWebStatus("Error")
      addToHistory(activeRequest)
    } finally {
      setWebLoading(false)
    }
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

  const handleGetStarted = useCallback(() => {
    setShowLanding(false)
  }, [])

  const handleBackToLanding = useCallback(() => {
    setShowLanding(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewRequest(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewRequest, openCommandPalette])

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

  const handleNewRootRequest = useCallback(() => handleNewRequest(null), [handleNewRequest])

  const handleCommand = useCommandHandler({
    onNewRequest: handleNewRootRequest,
    onSave: handleSave,
    onCreateFolder: handleCreateFolder,
    onReset: handleCommandReset
  })

  if (showLanding) {
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
          onSelectRequest={handleSelectRequest}
          onSelectHistoryItem={handleSelectHistoryItem}
          onDeleteHistoryItem={deleteHistoryItem}
          onClearHistory={handleClearHistory}
          onNewRequest={() => handleNewRequest(null)}
          onDeleteRequest={handleDelete}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onToggleFolder={handleToggleFolder}
          onNewRequestInFolder={handleNewRequest}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <RequestBar
            activeRequest={activeRequest}
            {...fieldHandlers}
            onSend={handleSend}
            onSave={handleSave}
            onGenerateCode={handleGenerateCode}
            loading={loading}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <RequestTabs
              activeRequest={activeRequest}
              onUpdateField={updateField}
              variables={variables}
              onUpdateVariables={setVariables}
              onSaveVars={handleSaveVars}
              response={activeRequest.response}
              responseStatus={status}
              responseHeaders={activeRequest.responseHeaders}
              EditorComponent={MonacoEditor}
              defaultTab={activeRequestTab || 'body'}
            />

            <ResponsePanel
              response={activeRequest.response}
              status={status}
              responseHeaders={activeRequest.responseHeaders}
              responseCookies={activeRequest.responseCookies}
              responseSize={activeRequest.responseSize}
              responseTime={responseTime}
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
              variables={parseJSON(variables, {})}
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
