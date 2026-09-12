import { useCallback } from "react"
import { generateAllSnippets } from "../lib/codeGenerator"
import { prepareRequest } from "../lib/requestUtils"
import { validateEnvVariables } from "../lib/validation"
import { useAppStore } from "../store/appStore"

export function useCreateFolderHandler() {
  const showPrompt = useAppStore((s) => s.showPrompt)
  const addFolder = useAppStore((s) => s.addFolder)

  return useCallback(() => {
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
}

export function useClearHistoryHandler() {
  const showConfirm = useAppStore((s) => s.showConfirm)
  const clearHistory = useAppStore((s) => s.clearHistory)

  return useCallback(() => {
    showConfirm(
      'Clear History',
      'Delete all history?',
      () => clearHistory(),
      null,
      'default'
    )
  }, [])
}

export function useGenerateCodeHandler(activeRequest, variablesMap) {
  const openCodeDialog = useAppStore((s) => s.openCodeDialog)
  const showAlert = useAppStore((s) => s.showAlert)

  return useCallback(() => {
    let prepared
    try {
      prepared = prepareRequest(activeRequest, variablesMap || {})
    } catch (e) {
      showAlert('Cannot Generate Code', e.message, 'OK', 'warning')
      return
    }

    // prepareRequest folds GraphQL into a JSON body, substitutes variables and
    // merges query params into the URL, so snippets match what the app sends.
    openCodeDialog(
      generateAllSnippets(
        prepared.method,
        prepared.url,
        JSON.stringify(prepared.headers),
        prepared.body || '',
        '{}'
      )
    )
  }, [activeRequest, variablesMap])
}

// `persist` runs after validation so callers that already auto-save can pass a
// no-op and still get the same validate-then-report flow.
export function useSaveVarsHandler(variables, persist) {
  const showAlert = useAppStore((s) => s.showAlert)

  return useCallback(async () => {
    const validation = validateEnvVariables(variables)
    if (!validation.valid) {
      showAlert('Validation Error', validation.error, 'OK', 'warning')
      return
    }

    try {
      const message = await persist(variables)
      showAlert('Success', message, 'OK', 'success')
    } catch (e) {
      console.error(e)
      showAlert('Error', `Failed to save: ${e.message}`, 'OK', 'warning')
    }
  }, [variables, persist])
}

export function useCommandHandler({ onNewRequest, onSave, onCreateFolder, onReset }) {
  const openImportDialog = useAppStore((s) => s.openImportDialog)

  return useCallback((action) => {
    switch (action) {
      case 'newRequest':
        onNewRequest()
        break
      case 'saveRequest':
        onSave()
        break
      case 'newFolder':
        onCreateFolder()
        break
      case 'export':
      case 'import':
        openImportDialog()
        break
      case 'reset':
        onReset('Clear all data? This cannot be undone.')
        break
    }
  }, [onNewRequest, onSave, onCreateFolder, onReset])
}
