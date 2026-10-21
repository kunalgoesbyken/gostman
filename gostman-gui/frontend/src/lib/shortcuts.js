import { chordLabel, chordModifiers, chordSignature, digitCode, isDigitChord, matchesChord, modifiersPrefix, reservedReason } from './chords.js'
import { isApplePlatform, isDesktopApp } from './platform.js'
import { getPreferences } from './preferences.js'
import { SHORTCUT_TEXT } from './shortcutText.js'

const TAB_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const FIRST_TAB_ID = 'tab1'

export const SHORTCUT_GROUPS = ['General', 'Request', 'Tabs', 'Navigation']

export const SHORTCUTS = [
  { id: 'commandPalette', group: 'General', label: 'Command palette', mod: true, key: 'k' },
  { id: 'findRequest', group: 'General', label: 'Go to request or history', mod: true, key: 'p' },
  { id: 'shortcutsHelp', group: 'General', label: 'Keyboard shortcuts', mod: true, key: '/' },
  { id: 'newRequest', group: 'Request', label: 'New request', mod: true, key: 'n' },
  { id: 'saveRequest', group: 'Request', label: 'Save request', mod: true, key: 's' },
  { id: 'sendRequest', group: 'Request', label: 'Send request', mod: true, key: 'enter' },
  { id: 'closeTab', group: 'Tabs', label: 'Close tab', mod: true, key: 'w', web: { alt: true, key: 'w' } },
  { id: 'reopenTab', group: 'Tabs', label: 'Reopen closed tab', mod: true, shift: true, key: 't', web: { alt: true, shift: true, key: 't' } },
  { id: 'nextTab', group: 'Tabs', label: 'Next tab', ctrl: true, key: 'tab', web: { alt: true, code: 'BracketRight' } },
  { id: 'previousTab', group: 'Tabs', label: 'Previous tab', ctrl: true, shift: true, key: 'tab', web: { alt: true, code: 'BracketLeft' } },
  ...TAB_POSITIONS.map((position) => ({
    id: `tab${position}`,
    group: 'Tabs',
    label: position === 9 ? 'Go to last tab' : `Go to tab ${position}`,
    alt: true,
    code: digitCode(position),
    position,
    listed: position === 1,
  })),
  { id: 'toggleSidebar', group: 'Navigation', label: 'Toggle sidebar', mod: true, key: 'b' },
  { id: 'focusSidebarSearch', group: 'Navigation', label: 'Search the sidebar', mod: true, shift: true, key: 'f' },
]

const byId = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

const ownerOf = (shortcut) => (shortcut.position ? byId.get(FIRST_TAB_ID) : shortcut)

const isAvailable = (shortcut, isDesktop) => isDesktop || shortcut.web !== false

const defaultBinding = (shortcut, isDesktop) => {
  if (isDesktop || shortcut.web === undefined) return shortcut
  if (!shortcut.web) return null
  return { id: shortcut.id, ...shortcut.web }
}

export function bindingFor(shortcut, isDesktop = isDesktopApp(), overrides = getPreferences().shortcuts) {
  const override = overrides[ownerOf(shortcut).id]
  if (override === undefined) return defaultBinding(shortcut, isDesktop)
  if (override === null) return null
  if (!shortcut.position) return { id: shortcut.id, ...override }
  return { id: shortcut.id, ...chordModifiers(override), code: digitCode(shortcut.position) }
}

export const activeShortcuts = (isDesktop = isDesktopApp(), overrides = getPreferences().shortcuts) => (
  SHORTCUTS.map((shortcut) => ({ shortcut, binding: bindingFor(shortcut, isDesktop, overrides) })).filter(({ binding }) => binding)
)

export const matchesBinding = (binding, event, isApple = isApplePlatform()) => matchesChord(binding, event, isApple)

export const bindingLabel = (binding, isApple = isApplePlatform()) => chordLabel(binding, isApple)

export const shortcutLabelFor = (id, overrides) => {
  const shortcut = byId.get(id)
  const binding = shortcut && bindingFor(shortcut, isDesktopApp(), overrides)
  return binding ? bindingLabel(binding) : ''
}

export const hintWithShortcut = (text, label) => (label ? `${text} (${label})` : text)

const candidateChords = (owner, chord) => (
  owner.position ? TAB_POSITIONS.map((position) => ({ ...chordModifiers(chord), code: digitCode(position) })) : [chord]
)

export function checkChord(id, chord, { isDesktop, isApple, overrides }) {
  const owner = ownerOf(byId.get(id))
  if (owner.position && !isDigitChord(chord)) return { error: 'needsDigit' }
  const candidates = candidateChords(owner, chord)
  const error = candidates.map((candidate) => reservedReason(candidate, { isDesktop, isApple })).find(Boolean)
  if (error) return { error }
  const taken = new Set(candidates.map((candidate) => chordSignature(candidate, isApple)))
  const conflict = activeShortcuts(isDesktop, overrides)
    .find(({ shortcut, binding }) => ownerOf(shortcut) !== owner && taken.has(chordSignature(binding, isApple)))
  return { conflict: conflict && ownerOf(conflict.shortcut) }
}

export const withChord = (overrides, id, chord) => ({ ...overrides, [ownerOf(byId.get(id)).id]: chord })

export function withoutChord(overrides, id) {
  const ownerId = ownerOf(byId.get(id)).id
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== ownerId))
}

const keysLabel = (shortcut, binding, isApple) => {
  if (!binding) return ''
  return shortcut.position ? SHORTCUT_TEXT.tabRange(modifiersPrefix(binding, isApple)) : bindingLabel(binding, isApple)
}

export function shortcutRows(overrides = getPreferences().shortcuts, isDesktop = isDesktopApp(), isApple = isApplePlatform()) {
  return SHORTCUTS
    .filter((shortcut) => shortcut.listed !== false && isAvailable(shortcut, isDesktop))
    .map((shortcut) => {
      const binding = bindingFor(shortcut, isDesktop, overrides)
      return {
        id: shortcut.id,
        group: shortcut.group,
        label: shortcut.position ? SHORTCUT_TEXT.tabRangeLabel : shortcut.label,
        binding,
        keys: keysLabel(shortcut, binding, isApple),
        isCustom: overrides[ownerOf(shortcut).id] !== undefined,
      }
    })
}
