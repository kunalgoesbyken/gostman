import { useCallback } from "react"

export function useRequestFieldHandlers(updateField) {
  return {
    onMethodChange: useCallback((value) => updateField('method', value), [updateField]),
    onUrlChange: useCallback((value) => updateField('url', value), [updateField]),
    onNameChange: useCallback((value) => updateField('name', value), [updateField]),
  }
}
