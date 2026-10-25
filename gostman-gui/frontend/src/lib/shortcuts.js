import { chordLabel, chordModifiers, chordSignature, digitCode, isDigitChord, matchesChord, modifiersPrefix, reservedReason } from './chords.js'
import { isApplePlatform, isDesktopApp } from './platform.js'
import { getPreferences } from './preferences.js'
import { SHORTCUT_TEXT } from './shortcutText.js'

const TAB_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const FIRST_TAB_ID = 'tab1'
const LAST_TAB_POSITION = 9

export const SHORTCUT_GROUPS = ['General', 'Request', 'Tabs', 'Navigation']

const REMOVE_CHORDS = [{ key: 'delete' }, { mod: true, key: 'backspace' }]

export const TREE_CHORDS = {
  moveUp: { alt: true, key: 'arrowup' },
  moveDown: { alt: true, key: 'arrowdown' },
  cut: { mod: true, key: 'x' },
  copy: { mod: true, key: 'c' },
  paste: { mod: true, key: 'v' },
  duplicate: { mod: true, key: 'd' },
  undo: { mod: true, key: 'z' },
  redo: { mod: true, shift: true, key: 'z' },
  redoAlternative: { mod: true, key: 'y' },
  toggleSelect: { ctrl: true, key: 'space' },
  extendUp: { shift: true, key: 'arrowup' },
  extendDown: { shift: true, key: 'arrowdown' },
  selectAll: { mod: true, key: 'a' },
}

export const MOVING_KEYS = [
  { id: 'lists', chords: [{ key: 'arrowup' }, { key: 'arrowdown' }, { key: 'home' }, { key: 'end' }] },
  { id: 'pages', chords: [{ key: 'pageup' }, { key: 'pagedown' }] },
  { id: 'tabs', chords: [{ key: 'arrowleft' }, { key: 'arrowright' }] },
  { id: 'folders', chords: [{ key: 'arrowleft' }, { key: 'arrowright' }] },
  { id: 'open', chords: [{ key: 'enter' }] },
  { id: 'preview', chords: [{ key: 'space' }] },
  { id: 'jump', chords: [] },
  { id: 'reorder', chords: [TREE_CHORDS.moveUp, TREE_CHORDS.moveDown] },
  { id: 'clipboard', chords: [TREE_CHORDS.cut, TREE_CHORDS.copy, TREE_CHORDS.paste] },
  { id: 'duplicate', chords: [TREE_CHORDS.duplicate] },
  { id: 'undoTree', chords: [TREE_CHORDS.undo, TREE_CHORDS.redo] },
  { id: 'select', chords: [TREE_CHORDS.toggleSelect, TREE_CHORDS.extendUp, TREE_CHORDS.extendDown, TREE_CHORDS.selectAll] },
  { id: 'rename', chords: [{ key: 'f2' }] },
  { id: 'remove', chords: REMOVE_CHORDS },
  { id: 'menu', chords: [{ shift: true, key: 'f10' }] },
  { id: 'results', chords: [{ key: 'arrowdown' }] },
  { id: 'close', chords: [{ key: 'escape' }] },
  { id: 'leaveEditor', chords: [{ key: 'escape' }, { key: 'tab' }] },
]

const labelled = (labelId, fields) => ({
  id: labelId,
  ...fields,
  get label() {
    return SHORTCUT_TEXT.labels[labelId]
  },
})

const tabShortcut = (position) => ({
  id: `tab${position}`,
  group: 'Tabs',
  get label() {
    return position === LAST_TAB_POSITION ? SHORTCUT_TEXT.labels.goToLastTab : SHORTCUT_TEXT.labels.goToTab(position)
  },
  alt: true,
  code: digitCode(position),
  position,
  listed: position === 1,
})

export const SHORTCUTS = [
  labelled('commandPalette', { group: 'General', mod: true, key: 'k' }),
  labelled('findRequest', { group: 'General', mod: true, key: 'p' }),
  labelled('shortcutsHelp', { group: 'General', mod: true, key: '/' }),
  labelled('newRequest', { group: 'Request', mod: true, key: 'n', web: { alt: true, key: 'n' } }),
  labelled('saveRequest', { group: 'Request', mod: true, key: 's' }),
  labelled('sendRequest', { group: 'Request', mod: true, key: 'enter' }),
  labelled('closeTab', { group: 'Tabs', mod: true, key: 'w', web: { alt: true, key: 'w' } }),
  labelled('reopenTab', { group: 'Tabs', mod: true, shift: true, key: 't', web: { alt: true, shift: true, key: 't' } }),
  labelled('closeOtherTabs', { group: 'Tabs', alt: true, shift: true, key: 'w' }),
  labelled('closeSavedTabs', { group: 'Tabs', alt: true, shift: true, key: 's' }),
  labelled('keepTab', { group: 'Tabs', alt: true, shift: true, key: 'k' }),
  labelled('nextTab', { group: 'Tabs', ctrl: true, key: 'tab', web: { alt: true, code: 'BracketRight' } }),
  labelled('previousTab', { group: 'Tabs', ctrl: true, shift: true, key: 'tab', web: { alt: true, code: 'BracketLeft' } }),
  ...TAB_POSITIONS.map(tabShortcut),
  labelled('aiGenerate', { ai: true, group: 'General', mod: true, shift: true, key: 'u', web: { alt: true, shift: true, key: 'u' } }),
  labelled('aiExplain', { ai: true, group: 'General', mod: true, shift: true, key: 'x', web: { alt: true, shift: true, key: 'x' } }),
  labelled('toggleSidebar', { group: 'Navigation', mod: true, key: 'b' }),
  labelled('focusSidebarSearch', { group: 'Navigation', mod: true, shift: true, key: 'f' }),
  labelled('nextPane', { group: 'Navigation', key: 'f6' }),
  labelled('previousPane', { group: 'Navigation', shift: true, key: 'f6' }),
  labelled('focusAddress', { group: 'Navigation', mod: true, key: 'l' }),
  labelled('workspaceSwitcher', { group: 'Navigation', mod: true, shift: true, key: 'o', web: false }),
  labelled('nextWorkspace', { group: 'Navigation', mod: true, shift: true, code: 'BracketRight', web: false }),
  labelled('previousWorkspace', { group: 'Navigation', mod: true, shift: true, code: 'BracketLeft', web: false }),
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

export const isRemoveKey = (event) => REMOVE_CHORDS.some((chord) => matchesBinding(chord, event))

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
        ai: Boolean(shortcut.ai),
      }
    })
}
