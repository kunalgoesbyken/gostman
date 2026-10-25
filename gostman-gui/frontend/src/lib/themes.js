import { hslTriplet, isDarkColor, isHexColor, mixColors } from './color.js'
import { isPlainObject, parseJSON } from './dataUtils.js'
import { STYLED_METHODS, methodBackgroundToken, methodToken } from './methodColors.js'

export const MODES = ['light', 'dark']
export const ROLES = ['background', 'foreground']

const WINDOW = 'window'

export const SURFACES = [
  { id: WINDOW },
  { id: 'sidebar', selector: '[data-pane="sidebar"]', parent: WINDOW },
  { id: 'tabs', selector: '[data-pane="tabs"], [data-pane="address"]', parent: WINDOW },
  { id: 'request', selector: '[data-pane="request"]', parent: WINDOW },
  { id: 'body', selector: '[data-surface="body"]', parent: 'request' },
  { id: 'script', selector: '[data-surface="script"]', parent: 'request' },
  { id: 'response', selector: '[data-pane="response"]', parent: WINDOW },
  { id: 'dialog', selector: '[data-surface="dialog"]', parent: WINDOW },
  { id: 'menu', selector: '[data-surface="menu"]', parent: WINDOW },
]

const SURFACE_IDS = SURFACES.map((surface) => surface.id)
const surfaceById = Object.fromEntries(SURFACES.map((surface) => [surface.id, surface]))

const BASE_COLORS = {
  light: { background: '#ffffff', foreground: '#0c111d' },
  dark: { background: '#030711', foreground: '#f8fafc' },
}

const tone = (background, foreground) => (foreground ? { background, foreground } : { background })

const PALETTES = {
  default: { light: {}, dark: {} },
  neutral: {
    light: { window: tone('#ffffff', '#171717'), sidebar: tone('#fafafa') },
    dark: { window: tone('#0a0a0a', '#ededed'), sidebar: tone('#121212') },
  },
  slate: {
    light: { window: tone('#f8fafc', '#0f172a'), sidebar: tone('#f1f5f9') },
    dark: { window: tone('#0f172a', '#e2e8f0'), sidebar: tone('#0b1221') },
  },
  paper: {
    light: { window: tone('#fbf9f4', '#29251f'), sidebar: tone('#f4f0e6') },
    dark: { window: tone('#1b1916', '#e9e3d8'), sidebar: tone('#161411') },
  },
  moss: {
    light: { window: tone('#f7f9f5', '#1c2a1f'), sidebar: tone('#eef3ea') },
    dark: { window: tone('#111712', '#dce6dc'), sidebar: tone('#0c110d') },
  },
  dusk: {
    light: { window: tone('#faf9fc', '#231f30'), sidebar: tone('#f2f0f7') },
    dark: { window: tone('#16141d', '#e5e1f0'), sidebar: tone('#110f17') },
  },
  ocean: {
    light: { window: tone('#f6fafb', '#0e2a33'), sidebar: tone('#ecf4f6') },
    dark: { window: tone('#0b181d', '#d6e8ec'), sidebar: tone('#081216') },
  },
  ink: {
    light: { window: tone('#ffffff', '#000000') },
    dark: { window: tone('#000000', '#f5f5f5') },
  },
}

export const PALETTE_IDS = Object.keys(PALETTES)
export const DEFAULT_PALETTE = 'default'
export const EMPTY_CUSTOM_COLORS = { light: {}, dark: {} }
export const EMPTY_METHOD_COLORS = { light: {}, dark: {} }

const MIXES = {
  standard: { card: 0.025, muted: 0.06, accent: 0.085, border: 0.16, input: 0.45, mutedForeground: 0.66 },
  more: { card: 0.025, muted: 0.06, accent: 0.085, border: 0.42, input: 0.6, mutedForeground: 0.82 },
}

const DARK_SURFACE_MIXES = { muted: 0.1 }

const TOKEN_NAMES = [
  'background', 'foreground', 'card', 'card-foreground', 'secondary', 'secondary-foreground',
  'muted', 'muted-foreground', 'accent', 'accent-foreground', 'border', 'input',
]

const TONE_TOKENS = [
  'brand', 'primary', 'primary-foreground', 'ring', 'destructive', 'destructive-foreground', 'success', 'success-foreground',
  'warning', 'warning-foreground', 'info', 'info-foreground', 'syntax-key', 'syntax-string', 'syntax-number', 'syntax-boolean',
  'syntax-null', 'syntax-punctuation',
]

const INHERITED_TOKENS = [...TOKEN_NAMES, ...TONE_TOKENS]

export const WINDOW_PROPERTIES = [...TOKEN_NAMES.map((name) => `--${name}`), 'color-scheme']

const PAINT = 'background-color: hsl(var(--background)); color: hsl(var(--foreground));'

const ownColors = (theme, mode, id) => ({ ...PALETTES[theme.palette][mode][id], ...theme.customColors[mode][id] })

const isCustomized = (theme, mode, id) => Object.keys(ownColors(theme, mode, id)).length > 0

export function effectiveColors(theme, mode, id) {
  const { parent } = surfaceById[id]
  const inherited = parent ? effectiveColors(theme, mode, parent) : BASE_COLORS[mode]
  return { ...inherited, ...ownColors(theme, mode, id) }
}

const toneOf = (colors) => (isDarkColor(colors.background) ? 'dark' : 'light')

export const windowTone = (theme, mode) => toneOf(effectiveColors(theme, mode, WINDOW))

const toneProperties = (tone) => Object.fromEntries(TONE_TOKENS.map((name) => [`--${name}`, `var(--${tone}-${name})`]))

const mixesFor = (background, contrast) => (isDarkColor(background) ? { ...MIXES[contrast], ...DARK_SURFACE_MIXES } : MIXES[contrast])

function surfaceTokens({ background, foreground }, contrast) {
  const mix = mixesFor(background, contrast)
  const toward = (amount) => hslTriplet(mixColors(background, foreground, amount))
  const text = hslTriplet(foreground)
  const muted = toward(mix.muted)
  const border = toward(mix.border)
  return {
    background: hslTriplet(background),
    foreground: text,
    card: toward(mix.card),
    'card-foreground': text,
    secondary: muted,
    'secondary-foreground': text,
    muted,
    'muted-foreground': toward(mix.mutedForeground),
    accent: toward(mix.accent),
    'accent-foreground': text,
    border,
    input: toward(mix.input),
  }
}

function surfaceProperties(colors, contrast) {
  const tokens = Object.entries(surfaceTokens(colors, contrast)).map(([name, value]) => [`--${name}`, value])
  return Object.fromEntries([...tokens, ['color-scheme', toneOf(colors)]])
}

export function windowProperties(theme, mode, contrast) {
  if (!isCustomized(theme, mode, WINDOW)) return {}
  return surfaceProperties(effectiveColors(theme, mode, WINDOW), contrast)
}

const declarations = (properties) => Object.entries(properties).map(([name, value]) => `${name}: ${value};`).join(' ')

const WINDOW_CAPTURE = `:root { ${declarations(Object.fromEntries(INHERITED_TOKENS.map((name) => [`--window-${name}`, `var(--${name})`])))} }`

const WINDOW_RESET = declarations(Object.fromEntries(INHERITED_TOKENS.map((name) => [`--${name}`, `var(--window-${name})`])))

function surfaceRule(theme, mode, contrast, surface) {
  if (isCustomized(theme, mode, surface.id)) {
    const colors = effectiveColors(theme, mode, surface.id)
    return `${surface.selector} { ${declarations({ ...surfaceProperties(colors, contrast), ...toneProperties(toneOf(colors)) })} ${PAINT} }`
  }
  return surface.parent === WINDOW ? `${surface.selector} { ${WINDOW_RESET} ${PAINT} }` : ''
}

export function themeStyleSheet(theme, mode, contrast) {
  if (!SURFACE_IDS.some((id) => isCustomized(theme, mode, id))) return ''
  const rules = SURFACES.filter((surface) => surface.selector).map((surface) => surfaceRule(theme, mode, contrast, surface))
  return [WINDOW_CAPTURE, ...rules].filter(Boolean).join('\n')
}

const entriesOf = (value) => (isPlainObject(value) ? value : {})

function normalizeSurfaceColors(raw) {
  const source = entriesOf(raw)
  return Object.fromEntries(ROLES.filter((role) => isHexColor(source[role])).map((role) => [role, source[role].toLowerCase()]))
}

function normalizeModeColors(raw, ids) {
  const source = entriesOf(raw)
  const entries = ids.map((id) => [id, normalizeSurfaceColors(source[id])])
  return Object.fromEntries(entries.filter(([, colors]) => Object.keys(colors).length > 0))
}

const normalizeColorSet = (raw, ids) => {
  const source = entriesOf(raw)
  return Object.fromEntries(MODES.map((mode) => [mode, normalizeModeColors(source[mode], ids)]))
}

export const normalizeCustomColors = (raw) => normalizeColorSet(raw, SURFACE_IDS)

export const normalizeMethodColors = (raw) => normalizeColorSet(raw, STYLED_METHODS)

export function withSurfaceColor(customColors, mode, id, role, value) {
  const surface = { ...customColors[mode][id], [role]: value }
  return { ...customColors, [mode]: { ...customColors[mode], [id]: surface } }
}

export function withoutSurface(customColors, mode, id) {
  const kept = Object.entries(customColors[mode]).filter(([key]) => key !== id)
  return { ...customColors, [mode]: Object.fromEntries(kept) }
}

export const withoutMode = (customColors, mode) => ({ ...customColors, [mode]: {} })

const methodProperties = (method, colors) => [
  colors.foreground && [methodToken(method), hslTriplet(colors.foreground)],
  colors.background && [methodBackgroundToken(method), colors.background],
].filter(Boolean)

export function methodStyleSheet(methodColors, mode) {
  const properties = Object.entries(methodColors[mode]).flatMap(([method, colors]) => methodProperties(method, colors))
  return properties.length > 0 ? `:root { ${declarations(Object.fromEntries(properties))} }` : ''
}

const THEME_FORMAT = 1
const THEME_TEXT_LIMIT = 20000
const DOCUMENT_KEYS = ['gostmanTheme', 'palette', 'accent', 'colors', 'methods']

const hasOnly = (value, keys) => isPlainObject(value) && Object.keys(value).every((key) => keys.includes(key))
const isSurfaceEntry = (value) => hasOnly(value, ROLES) && Object.values(value).every(isHexColor)
const isModeEntry = (ids) => (value) => hasOnly(value, ids) && Object.values(value).every(isSurfaceEntry)
const isColorSet = (value, ids) => hasOnly(value, MODES) && Object.values(value).every(isModeEntry(ids))
const isOptional = (value, isValid) => value === undefined || isValid(value)

const isThemeDocument = (value, accents) =>
  hasOnly(value, DOCUMENT_KEYS) && value.gostmanTheme === THEME_FORMAT && PALETTE_IDS.includes(value.palette) &&
  isColorSet(value.colors, SURFACE_IDS) && isOptional(value.methods, (methods) => isColorSet(methods, STYLED_METHODS)) &&
  isOptional(value.accent, (accent) => accents.includes(accent) || isHexColor(accent))

export const serializeTheme = ({ palette, accent, customColors, methodColors }) => (
  JSON.stringify({ gostmanTheme: THEME_FORMAT, palette, accent, colors: customColors, methods: methodColors }, null, 2)
)

export function parseTheme(text, accents) {
  const value = text.length <= THEME_TEXT_LIMIT ? parseJSON(text, null) : null
  if (!isThemeDocument(value, accents)) return null
  return {
    palette: value.palette,
    ...(value.accent !== undefined && { accent: value.accent }),
    customColors: normalizeCustomColors(value.colors),
    methodColors: normalizeMethodColors(value.methods),
  }
}
