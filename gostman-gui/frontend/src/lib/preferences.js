import { create } from 'zustand'
import { ACCENT_PROPERTIES, CUSTOM_ACCENT, accentProperties } from './accent.js'
import { sanitizeOverrides } from './chords.js'
import { isHexColor } from './color.js'
import { isPlainObject, parseJSON } from './dataUtils.js'
import { FONT_SLOTS, applyFont } from './fonts.js'
import { readStored, writeStored } from './storage.js'
import { normalizeTagColors } from './tagColors.js'
import {
  DEFAULT_PALETTE, EMPTY_CUSTOM_COLORS, EMPTY_METHOD_COLORS, PALETTE_IDS, WINDOW_PROPERTIES, methodStyleSheet, normalizeCustomColors, normalizeMethodColors,
  parseTheme, serializeTheme, themeStyleSheet, windowProperties, windowTone,
} from './themes.js'
import { reportWindowTheme } from './windowTheme.js'

const STORAGE_KEY = 'gostman.preferences'
const THEME_STYLE_ID = 'gostman-theme'
const SCHEMA_VERSION = 1
const SYSTEM_QUERIES = {
  systemIsDark: '(prefers-color-scheme: dark)',
  systemWantsMoreContrast: '(prefers-contrast: more)',
}

export const THEMES = ['system', 'light', 'dark']
export const CONTRASTS = ['system', 'standard', 'more']
export const ACCENTS = ['cyan', 'blue', 'violet', 'pink', 'graphite']
export const TEXT_SCALES = [90, 100, 110, 125]
export const FONT_NAME_LENGTH = 100
export const DENSITIES = ['comfortable', 'compact']
export const RESPONSE_LAYOUTS = ['below', 'right']
export const LANGUAGES = [{ value: 'en', direction: 'ltr' }]
export const EDITOR_FONT_SIZES = { min: 10, max: 24 }
export const REQUEST_TIMEOUT_SECONDS = { min: 0, max: 3600 }

export const DEFAULT_PREFERENCES = {
  theme: 'system',
  contrast: 'system',
  accent: 'cyan',
  accentColor: '',
  palette: DEFAULT_PALETTE,
  customColors: EMPTY_CUSTOM_COLORS,
  methodColors: EMPTY_METHOD_COLORS,
  tagColors: {},
  textScale: 100,
  interfaceFont: '',
  codeFont: '',
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
const isPrintable = (text) => [...text].every((character) => character >= ' ' && character !== '\u007f')
const isFontName = (value) => typeof value === 'string' && value === value.trim() && value.length <= FONT_NAME_LENGTH && isPrintable(value)

const VALIDATORS = {
  theme: oneOf(THEMES),
  contrast: oneOf(CONTRASTS),
  accent: oneOf([...ACCENTS, CUSTOM_ACCENT]),
  palette: oneOf(PALETTE_IDS),
  textScale: oneOf(TEXT_SCALES),
  interfaceFont: isFontName,
  codeFont: isFontName,
  density: oneOf(DENSITIES),
  responseLayout: oneOf(RESPONSE_LAYOUTS),
  editorFontSize: integerWithin(EDITOR_FONT_SIZES),
  wrapLines: isFlag,
  requestTimeoutSeconds: integerWithin(REQUEST_TIMEOUT_SECONDS),
  confirmCloseTab: isFlag,
  language: oneOf(LANGUAGES.map((language) => language.value)),
}

const withUsableAccent = (preferences) => (
  preferences.accent === CUSTOM_ACCENT && preferences.accentColor === '' ? { ...preferences, accent: DEFAULT_PREFERENCES.accent } : preferences
)

export function normalizePreferences(raw) {
  const source = isPlainObject(raw) ? raw : {}
  const checked = Object.entries(VALIDATORS).map(([name, isValid]) => [name, isValid(source[name]) ? source[name] : DEFAULT_PREFERENCES[name]])
  return withUsableAccent({
    ...Object.fromEntries(checked),
    accentColor: isHexColor(source.accentColor) ? source.accentColor.toLowerCase() : '',
    customColors: normalizeCustomColors(source.customColors),
    methodColors: normalizeMethodColors(source.methodColors),
    tagColors: normalizeTagColors(source.tagColors),
    shortcuts: sanitizeOverrides(source.shortcuts),
  })
}

const themeAccent = ({ accent, accentColor }) => (accent === CUSTOM_ACCENT ? accentColor : accent)

const preferredAccent = (accent) => (isHexColor(accent) ? { accent: CUSTOM_ACCENT, accentColor: accent.toLowerCase() } : { accent })

export const themeText = (preferences) => serializeTheme({ ...preferences, accent: themeAccent(preferences) })

export function themeFromText(text) {
  const theme = parseTheme(text, ACCENTS)
  if (!theme) return null
  const { accent, ...colors } = theme
  return accent === undefined ? colors : { ...colors, ...preferredAccent(accent) }
}

export const resolveTheme = (theme, systemIsDark) => {
  if (theme === 'system') return systemIsDark ? 'dark' : 'light'
  return theme
}

const resolveContrast = (contrast, systemWantsMoreContrast) => {
  if (contrast === 'system') return systemWantsMoreContrast ? 'more' : 'standard'
  return contrast
}

const readPreferences = () => parseJSON(readStored(STORAGE_KEY) ?? '', null)

const writePreferences = (preferences) => writeStored(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...preferences }))

export const usePreferencesStore = create((set) => ({
  preferences: normalizePreferences(readPreferences()),
  systemIsDark: false,
  systemWantsMoreContrast: false,
  update: (patch) => set((state) => ({ preferences: normalizePreferences({ ...state.preferences, ...patch }) })),
  reset: () => set((state) => ({ preferences: { ...DEFAULT_PREFERENCES, shortcuts: state.preferences.shortcuts, tagColors: state.preferences.tagColors } })),
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

function themeStyleElement() {
  const existing = document.getElementById(THEME_STYLE_ID)
  if (existing) return existing
  const style = document.createElement('style')
  style.id = THEME_STYLE_ID
  return document.head.appendChild(style)
}

function applyThemeColors(root, preferences, mode, contrast) {
  const properties = { ...windowProperties(preferences, mode, contrast), ...accentProperties(preferences) }
  const names = [...WINDOW_PROPERTIES, ...ACCENT_PROPERTIES]
  names.forEach((name) => (properties[name] ? root.style.setProperty(name, properties[name]) : root.style.removeProperty(name)))
  const sheet = [themeStyleSheet(preferences, mode, contrast), methodStyleSheet(preferences.methodColors, mode)].filter(Boolean).join('\n')
  const style = themeStyleElement()
  if (style.textContent !== sheet) style.textContent = sheet
}

function applyToDocument({ preferences, systemIsDark, systemWantsMoreContrast }) {
  const root = document.documentElement
  const language = LANGUAGES.find((candidate) => candidate.value === preferences.language)
  const mode = resolveTheme(preferences.theme, systemIsDark)
  const contrast = resolveContrast(preferences.contrast, systemWantsMoreContrast)
  root.classList.toggle('dark', windowTone(preferences, mode) === 'dark')
  root.dataset.contrast = contrast
  root.dataset.accent = preferences.accent
  applyThemeColors(root, preferences, mode, contrast)
  root.style.setProperty('--text-scale', preferences.textScale)
  Object.entries(FONT_SLOTS).forEach(([name, slot]) => applyFont(root, slot, preferences[name]))
  root.dataset.density = preferences.density
  root.dataset.responseLayout = preferences.responseLayout
  root.lang = language.value
  root.dir = language.direction
}

function watchSystemSettings() {
  Object.entries(SYSTEM_QUERIES).forEach(([name, query]) => {
    const media = window.matchMedia(query)
    usePreferencesStore.setState({ [name]: media.matches })
    media.addEventListener('change', (event) => usePreferencesStore.setState({ [name]: event.matches }))
  })
}

export function watchPreferences() {
  let reportedTheme = ''
  const sync = (state) => {
    applyToDocument(state)
    const theme = windowTone(state.preferences, resolveTheme(state.preferences.theme, state.systemIsDark))
    if (theme !== reportedTheme) reportWindowTheme(theme)
    reportedTheme = theme
  }
  watchSystemSettings()
  sync(usePreferencesStore.getState())
  usePreferencesStore.subscribe((state, previous) => {
    sync(state)
    if (state.preferences !== previous.preferences) writePreferences(state.preferences)
  })
}
