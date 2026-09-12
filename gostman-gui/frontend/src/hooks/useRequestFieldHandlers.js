import { useCallback } from "react"

export function useRequestFieldHandlers(updateField) {
  return {
    onMethodChange: useCallback((val) => updateField('method', val), [updateField]),
    onUrlChange: useCallback((val) => updateField('url', val), [updateField]),
    onNameChange: useCallback((val) => updateField('name', val), [updateField]),
    onHeadersChange: useCallback((val) => updateField('headers', val), [updateField]),
    onBodyChange: useCallback((val) => updateField('body', val), [updateField]),
    onQueryParamsChange: useCallback((val) => updateField('queryParams', val), [updateField]),
  }
}
