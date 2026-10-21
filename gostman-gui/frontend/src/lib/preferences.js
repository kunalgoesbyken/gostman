import { create } from 'zustand'
import { sanitizeOverrides } from './chords.js'
import { isPlainObject, parseJSON } from './dataUtils.js'
import { reportWindowTheme } from './windowTheme.js'

const STORAGE_KEY = 'gostman.preferences'
const SCHEMA_VERSION = 1
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export const THEMES = ['system', 'light', 'dark']
export const DENSITIES = ['comfortable', 'compact']
export const RESPONSE_LAYOUTS = ['below', 'right']
export const LANGUAGES = [{ value: 'en', direction: 'ltr' }]
export const EDITOR_FONT_SIZES = { min: 10, max: 24 }
export const REQUEST_TIMEOUT_SECONDS = { min: 0, max: 3600 }

export const DEFAULT_PREFERENCES = {
  theme: 'system',
  density: 'comfortable',
  responseLayout: 'below',
  editorFontSize: 12,
  wrapLines: true,
  requestTimeoutSeconds: 0,
  confirmCloseTab: true,
  language: 'en',
  shortcuts: {},
}

const oneOf = (allowed) => (value) => allowed.includes(value)
const integerWithin = ({ min, max }) => (value) => Number.isInteger(value) && value >= min && value <= max
const isFlag = (value) => typeof value === 'boolean'

const VALIDATORS = {
  theme: oneOf(THEMES),
  density: oneOf(DENSITIES),
  responseLayout: oneOf(RESPONSE_LAYOUTS),
  editorFontSize: integerWithin(EDITOR_FONT_SIZES),
  wrapLines: isFlag,
  requestTimeoutSeconds: integerWithin(REQUEST_TIMEOUT_SECONDS),
  confirmCloseTab: isFlag,
  language: oneOf(LANGUAGES.map((language) => language.value)),
}

export function normalizePreferences(raw) {
  const source = isPlainObject(raw) ? raw : {}
  const checked = Object.entries(VALIDATORS).map(([name, isValid]) => [name, isValid(source[name]) ? source[name] : DEFAULT_PREFERENCES[name]])
  return { ...Object.fromEntries(checked), shortcuts: sanitizeOverrides(source.shortcuts) }
}

export const resolveTheme = (theme, systemIsDark) => {
  if (theme === 'system') return systemIsDark ? 'dark' : 'light'
  return theme
}

function readStored() {
  try {
    return parseJSON(localStorage.getItem(STORAGE_KEY) ?? '', null)
  } catch {
    return null
  }
}

function writeStored(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...preferences }))
  } catch {
    return
  }
}

export const usePreferencesStore = create((set) => ({
  preferences: normalizePreferences(readStored()),
  systemIsDark: false,
  update: (patch) => set((state) => ({ preferences: normalizePreferences({ ...state.preferences, ...patch }) })),
  reset: () => set((state) => ({ preferences: { ...DEFAULT_PREFERENCES, shortcuts: state.preferences.shortcuts } })),
}))

export const getPreferences = () => usePreferencesStore.getState().preferences

export const updatePreferences = (patch) => usePreferencesStore.getState().update(patch)

export const resetPreferences = () => usePreferencesStore.getState().reset()

export const usePreferences = () => usePreferencesStore((state) => state.preferences)

export const useResolvedTheme = () => usePreferencesStore((state) => resolveTheme(state.preferences.theme, state.systemIsDark))

export const withPreferredTimeout = (request) => {
  const { requestTimeoutSeconds } = getPreferences()
  if (request.options?.timeoutMs > 0 || requestTimeoutSeconds === 0) return request
  return { ...request, options: { ...request.options, timeoutMs: requestTimeoutSeconds * 1000 } }
}

function applyToDocument({ preferences, systemIsDark }) {
  const root = document.documentElement
  const language = LANGUAGES.find((candidate) => candidate.value === preferences.language)
  root.classList.toggle('dark', resolveTheme(preferences.theme, systemIsDark) === 'dark')
  root.dataset.density = preferences.density
  root.dataset.responseLayout = preferences.responseLayout
  root.lang = language.value
  root.dir = language.direction
}

export function watchPreferences() {
  const systemScheme = window.matchMedia(DARK_SCHEME_QUERY)
  let reportedTheme = ''
  const sync = (state) => {
    applyToDocument(state)
    const theme = resolveTheme(state.preferences.theme, state.systemIsDark)
    if (theme !== reportedTheme) reportWindowTheme(theme)
    reportedTheme = theme
  }
  usePreferencesStore.setState({ systemIsDark: systemScheme.matches })
  sync(usePreferencesStore.getState())
  usePreferencesStore.subscribe((state, previous) => {
    sync(state)
    if (state.preferences !== previous.preferences) writeStored(state.preferences)
  })
  systemScheme.addEventListener('change', (event) => usePreferencesStore.setState({ systemIsDark: event.matches }))
}
