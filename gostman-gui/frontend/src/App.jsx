import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { RotateCcw, Import, Loader2 } from "lucide-react"
import { SendRequest, GetRequests, SaveRequest, DeleteRequest, GetVariables, SaveVariables, ResetData, GetFolders, SaveFolders, GetHistory, SaveHistory } from "../wailsjs/go/main/App"
import { Sidebar } from "./components/Sidebar"
import { RequestBar } from "./components/RequestBar"
import { ResponsePanel } from "./components/ResponsePanel"
import { AlertDialog } from "./components/ui/AlertDialog"
import { ConfirmDialog } from "./components/ui/ConfirmDialog"
import { PromptDialog } from "./components/ui/PromptDialog"
import { CommandPalette } from "./components/ui/CommandPalette"
// Lazy load heavy dialogs
const CodeSnippetDialog = lazy(() => import("./components/CodeSnippetDialog").then(module => ({ default: module.CodeSnippetDialog })))
const ImportExportDialog = lazy(() => import("./components/ImportExportDialog").then(module => ({ default: module.ImportExportDialog })))
const MonacoEditor = lazy(() => import("./components/MonacoEditor").then(module => ({ default: module.MonacoEditor })))
import { TabBar } from "./components/TabBar"
import { Button } from "./components/ui/button"
import { RequestTabs } from "./components/RequestTabs"
import { generateAllSnippets } from "./lib/codeGenerator"
import { useAppStore, useActiveTab } from "./store/appStore"
import { parseJSON } from "./lib/dataUtils"
import { validateEnvVariables } from "./lib/validation"
import logo from "./assets/logo.jpg"

function App() {
  // Guards the folder/history persistence effects until the initial disk load
  // completes (see fetchInitialData below).
  const [initialDataLoaded, setInitialDataLoaded] = useState(false)

  // Zustand store hooks
  const requests = useAppStore((s) => s.requests)
  const requestHistory = useAppStore((s) => s.requestHistory)
  const folders = useAppStore((s) => s.folders)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const variables = useAppStore((s) => s.variables)
  const codeDialogOpen = useAppStore((s) => s.codeDialogOpen)
  const codeSnippets = useAppStore((s) => s.codeSnippets)
  const importDialogOpen = useAppStore((s) => s.importDialogOpen)
  const activeRequestTab = useAppStore((s) => s.activeRequestTab)

  // Dialog state
  const alertDialog = useAppStore((s) => s.alertDialog)
  const confirmDialog = useAppStore((s) => s.confirmDialog)
  const promptDialog = useAppStore((s) => s.promptDialog)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)

  // Store actions
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
  const clearHistory = useAppStore((s) => s.clearHistory)
  const addFolder = useAppStore((s) => s.addFolder)
  const deleteFolder = useAppStore((s) => s.deleteFolder)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const openCodeDialog = useAppStore((s) => s.openCodeDialog)
  const closeCodeDialog = useAppStore((s) => s.closeCodeDialog)
  const openImportDialog = useAppStore((s) => s.openImportDialog)
  const closeImportDialog = useAppStore((s) => s.closeImportDialog)

  // Dialog actions
  const showAlert = useAppStore((s) => s.showAlert)
  const closeAlert = useAppStore((s) => s.closeAlert)
  const showConfirm = useAppStore((s) => s.showConfirm)
  const closeConfirm = useAppStore((s) => s.closeConfirm)
  const showPrompt = useAppStore((s) => s.showPrompt)
  const closePrompt = useAppStore((s) => s.closePrompt)
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)
  const closeCommandPalette = useAppStore((s) => s.closeCommandPalette)

  // Get active tab
  const activeTab = useActiveTab()
  const activeRequest = activeTab?.request || {}

  // Stable callbacks for RequestBar (React.memo)
  const updateField = useCallback((field, value) => {
    updateActiveRequest({ [field]: value })
  }, [])
  const handleMethodChange = useCallback((val) => updateField('method', val), [updateField])
  const handleUrlChange = useCallback((val) => updateField('url', val), [updateField])
  const handleNameChange = useCallback((val) => updateField('name', val), [updateField])
  const handleHeadersChange = useCallback((val) => updateField('headers', val), [updateField])
  const handleBodyChange = useCallback((val) => updateField('body', val), [updateField])
  const handleQueryParamsChange = useCallback((val) => updateField('queryParams', val), [updateField])

  // -- Data Loading --

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

  // Persist folders / history to disk whenever they change (desktop only).
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K - Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openCommandPalette()
      }
      // Ctrl/Cmd + N - New request
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        newTab()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [newTab, openCommandPalette])

  const handleCreateFolder = useCallback(() => {
    showPrompt(
      'New Folder',
      'Folder name:',
      '',
      'My Folder',
      (name) => {
        if (name?.trim()) {
          addFolder(name.trim())
        }
      }
    )
  }, [])

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
        activeRequest.graphqlVariables || ""
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
  }, [activeRequest])

  const handleClearHistory = useCallback(() => {
    showConfirm(
      'Clear History',
      'Delete all history?',
      () => clearHistory(),
      null,
      'default'
    )
  }, [])

  const handleSaveVars = useCallback(async () => {
    // Validate before saving
    const validation = validateEnvVariables(variables)
    if (!validation.valid) {
      showAlert('Validation Error', validation.error, 'OK', 'warning')
      return
    }

    try {
      const msg = await SaveVariables(variables)
      showAlert('Success', msg, 'OK', 'success')
    } catch (e) {
      console.error(e)
      showAlert('Error', `Failed to save: ${e.message}`, 'OK', 'warning')
    }
  }, [variables])

  const handleGenerateCode = useCallback(() => {
    const snippets = generateAllSnippets(
      activeRequest.method,
      activeRequest.url,
      activeRequest.headers,
      activeRequest.body,
      activeRequest.queryParams
    )
    openCodeDialog(snippets)
  }, [activeRequest])

  const handleImport = useCallback(async (importData) => {
    try {
      if (importData.requests) {
        // Import each request
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

  // Command palette handler
  const handleCommand = useCallback((action) => {
    switch (action) {
      case 'newRequest':
        newTab()
        break
      case 'saveRequest':
        handleSave()
        break
      case 'newFolder':
        handleCreateFolder()
        break
      case 'export':
        openImportDialog()
        break
      case 'import':
        openImportDialog()
        break
      case 'reset':
        showConfirm(
          'Reset App',
          'Clear all data? This cannot be undone.',
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
        break
    }
  }, [handleSave, handleCreateFolder])



  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 bg-muted/10 backdrop-blur-md px-6 py-2.5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Gostman Logo" className="h-9 w-9 rounded-lg shadow-lg shadow-primary/25" />
          <div>
            <h1 className="text-base font-brand font-bold tracking-tight">Gostman</h1>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">HTTP Client</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openImportDialog}
            className="gap-2"
          >
            <Import className="h-4 w-4" />
            Import
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              showConfirm(
                'Reset App',
                'Clear all data?',
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
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
            title="Reset to default (Clear data)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
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
          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={setActiveTab}
            onTabClose={closeTab}
            onNewTab={newTab}
          />

          <RequestBar
            activeRequest={activeRequest}
            onMethodChange={handleMethodChange}
            onUrlChange={handleUrlChange}
            onNameChange={handleNameChange}
            onHeadersChange={handleHeadersChange}
            onBodyChange={handleBodyChange}
            onQueryParamsChange={handleQueryParamsChange}
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

      {/* Code Snippet Dialog */}
      <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        {codeDialogOpen && codeSnippets && (
          <CodeSnippetDialog
            snippets={codeSnippets}
            onClose={closeCodeDialog}
          />
        )}
      </Suspense>

      {/* Import/Export Dialog */}
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

      {/* Custom Dialogs (non-blocking alternatives to alert/confirm/prompt) */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        confirmText={alertDialog.confirmText}
        variant={alertDialog.variant}
        onConfirm={closeAlert}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        onConfirm={() => {
          confirmDialog.onConfirm?.()
          closeConfirm()
        }}
        onCancel={closeConfirm}
      />

      <PromptDialog
        isOpen={promptDialog.isOpen}
        title={promptDialog.title}
        message={promptDialog.message}
        placeholder={promptDialog.placeholder}
        defaultValue={promptDialog.defaultValue}
        confirmText={promptDialog.confirmText}
        onConfirm={(value) => {
          promptDialog.onConfirm?.(value)
          closePrompt()
        }}
        onCancel={closePrompt}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={closeCommandPalette}
        onCommand={handleCommand}
      />
    </div>
  )
}

export default App
