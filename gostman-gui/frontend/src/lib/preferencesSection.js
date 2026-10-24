import { createStoredState } from './storage'

const STORAGE_KEY = 'gostman.preferencesSection'

export const SECTION_AI = 'ai'

export const usePreferencesSection = createStoredState(STORAGE_KEY, (source) => ({
  id: typeof source.id === 'string' ? source.id : '',
}))

export const selectPreferencesSection = (id) => usePreferencesSection.getState().update({ id })
