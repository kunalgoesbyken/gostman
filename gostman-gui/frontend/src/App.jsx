import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { Loader2 } from "lucide-react"
import { SendRequest, GetRequests, SaveRequest, DeleteRequest, GetVariables, SaveVariables, ResetData, GetFolders, SaveFolders, GetHistory, SaveHistory } from "../wailsjs/go/main/App"
import { Sidebar } from "./components/Sidebar"
import { RequestBar } from "./components/RequestBar"
import { ResponsePanel } from "./components/ResponsePanel"
import { AppDialogs } from "./components/AppDialogs"
import { AppHeader } from "./components/AppHeader"
const CodeSnippetDialog = lazy(() => import("./components/CodeSnippetDialog").then(module => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./components/ImportExportDialog").then(module => ({ default: module.ImportExportDialog })))
const MonacoEditor = lazy(() => import("./components/MonacoEditor").then(module => ({ default: module.MonacoEditor })))
import { TabBar } from "./components/TabBar"
import { RequestTabs } from "./components/RequestTabs"
import { useAppStore, useActiveTab } from "./store/appStore"
import { useDialogActions } from "./hooks/useDialogActions"
import { useRequestFieldHandlers } from "./hooks/useRequestFieldHandlers"
import { useClearHistoryHandler, useCommandHandler, useCreateFolderHandler, useGenerateCodeHandler, useSaveVarsHandler } from "./hooks/useSharedHandlers"
import { parseJSON } from "./lib/dataUtils"

function App() {
  // Guards the folder/history persistence effects until the initial disk load
  // completes (see fetchInitialData below).
  const [initialDataLoaded, setInitialDataLoaded] = useState(false)

  const requests = useAppStore((s) => s.requests)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const folders = useAppStore((s) => s.folders)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const variables = useAppStore((s) => s.variables)
  const variablesMap = useMemo(() => parseJSON(variables, {}), [variables])
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
  const addToHistory = useAppStore((s) => s.addToHistory)
  const deleteHistoryItem = useAppStore((s) => s.deleteHistoryItem)
  const deleteFolder = useAppStore((s) => s.deleteFolder)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const openImportDialog = useAppStore((s) => s.openImportDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)

  const { showAlert, showConfirm, openCommandPalette } = useDialogActions()

  const activeTab = useActiveTab()
  const activeRequest = activeTab?.request || {}

  // Declared before the field handlers that close over it: moving it later
  // reintroduces a TDZ crash (see commit 80c683a).
  const updateField = useCallback((field, value) => {
    updateActiveRequest({ [field]: value })
  }, [])
  const fieldHandlers = useRequestFieldHandlers(updateField)

  const fetchInitialData = useCallback(async () => {
    try {
      const [reqs, vars, flds, hist] = await Promise.all([
        GetRequests(), GetVariables(), GetFolders(), GetHistory()
      ])
      setRequests(reqs || [])
      setVariables(vars || "{}")
      setFolders(flds || [])
      setRequestHistory(hist || [])
    } catch (e) {
      console.error("Failed to load data:", e)
    } finally {
      setInitialDataLoaded(true)
    }
  }, [setRequests, setVariables, setFolders, setRequestHistory])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  // Skipped until the initial load finishes so we never overwrite saved data
  // with the empty pre-load state.
  useEffect(() => {
    if (!initialDataLoaded) return
    SaveFolders(folders || []).catch((e) => console.error("Failed to save folders:", e))
  }, [folders, initialDataLoaded])

  useEffect(() => {
    if (!initialDataLoaded) return
    SaveHistory(requestHistory || []).catch((e) => console.error("Failed to save history:", e))
  }, [requestHistory, initialDataLoaded])

  const refreshRequests = useCallback(async () => {
    const reqs = await GetRequests()
    setRequests(reqs || [])
  }, [])

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

  const handleCreateFolder = useCreateFolderHandler()
  const handleClearHistory = useClearHistoryHandler()
  const handleGenerateCode = useGenerateCodeHandler(activeRequest, variablesMap)
  const handleSaveVars = useSaveVarsHandler(variables, SaveVariables)

  const handleDeleteFolder = useCallback((folderId) => {
    showConfirm(
      'Delete Folder',
      'Move requests to root?',
      async () => {
        const affected = requests.filter(r => r.folderId === folderId)
        let hasError = false
        for (const req of affected) {
          try {
            await SaveRequest({ ...req, folderId: "" })
          } catch (e) {
            console.error(e)
            hasError = true
          }
        }
        setRequests(requests.map(r => r.folderId === folderId ? { ...r, folderId: "" } : r))
        deleteFolder(folderId)
        if (hasError) {
          showAlert('Warning', 'Some requests could not be saved to disk, but local state has been updated.', 'OK', 'warning')
        }
      },
      null,
      'default'
    )
  }, [requests])

  const handleSave = useCallback(async () => {
    try {
      const msg = await SaveRequest(activeRequest)
      showAlert('Success', msg, 'OK', 'success')
      await refreshRequests()
    } catch (e) {
      console.error(e)
      showAlert('Error', `Failed to save: ${e.message}`, 'OK', 'warning')
    }
  }, [activeRequest, refreshRequests])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    showConfirm(
      'Delete Request',
      'Can\'t be undone.',
      async () => {
        try {
          await DeleteRequest(id)
          await refreshRequests()
          newTab()
        } catch (e) {
          console.error(e)
          showAlert('Error', `Failed to delete: ${e.message}`, 'OK', 'warning')
        }
      },
      null,
      'destructive'
    )
  }, [refreshRequests])

  const handleSend = useCallback(async () => {
    updateActiveTab({ loading: true, status: 'Sending...', responseTime: null })
    const startTime = performance.now()

    const getResponseTime = () => Math.round(performance.now() - startTime)

    try {
      const resp = await SendRequest(
        activeRequest.method,
        activeRequest.url,
        activeRequest.headers,
        activeRequest.body,
        activeRequest.queryParams,
        activeRequest.graphqlQuery || "",
        activeRequest.graphqlVariables || "",
        // Live editor state, not the saved-to-disk copy, so unsaved Env Vars
        // edits apply immediately — matching the web target.
        variables || ""
      )

      updateActiveRequest({ response: resp.body })
      updateActiveTab({
        status: resp.status,
        responseTime: getResponseTime(),
        loading: false,
        responseHeaders: resp.headers || null,
        responseCookies: resp.cookies || null,
        responseSize: resp.size || null
      })

      addToHistory(activeRequest)
    } catch (e) {
      updateActiveRequest({ response: e.message || String(e) })
      updateActiveTab({
        status: "Error",
        responseTime: getResponseTime(),
        loading: false,
        responseHeaders: null,
        responseCookies: null,
        responseSize: null
      })

      addToHistory(activeRequest)
    }
  }, [activeRequest, variables])

  const handleImport = useCallback(async (importData) => {
    try {
      if (importData.requests) {
        for (const req of importData.requests) {
          await SaveRequest(req)
        }
        await refreshRequests()
      }
      if (importData.folders && Array.isArray(importData.folders)) {
        setFolders(prev => {
          const folderMap = new Map()
          prev.forEach(f => folderMap.set(f.id, f))
          importData.folders.forEach(f => folderMap.set(f.id, f))
          return Array.from(folderMap.values())
        })
      }
      if (importData.variables) {
        const varsStr = JSON.stringify(importData.variables, null, 2)
        setVariables(varsStr)
        await SaveVariables(varsStr)
      }
      showAlert('Success', 'Imported!', 'OK', 'success')
    } catch (e) {
      console.error("Import failed:", e)
      showAlert('Import Failed', e.message, 'OK', 'warning')
    }
  }, [refreshRequests])

  const handleReset = useCallback((message = 'Clear all data?') => {
    showConfirm(
      'Reset App',
      message,
      async () => {
        try {
          await ResetData()
          try {
            localStorage.clear()
          } catch (e) {
            console.warn("Could not clear localStorage:", e)
          }
          window.location.reload()
        } catch (e) {
          showAlert('Error', `Reset failed: ${e.message || String(e)}`, 'OK', 'warning')
        }
      },
      null,
      'destructive'
    )
  }, [])

  const handleCommand = useCommandHandler({
    onNewRequest: newTab,
    onSave: handleSave,
    onCreateFolder: handleCreateFolder,
    onReset: handleReset
  })

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppHeader
        className="border-b border-border/60 py-2.5"
        onImport={openImportDialog}
        onReset={handleReset}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          requests={requests}
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
  )
}

export default App
