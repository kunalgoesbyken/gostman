// The single table of keyboard bindings. useShortcuts matches events against it
// and the palette and the shortcuts dialog render labels from it.
//
// A binding names its key as `key` (event.key, lower-case) or `code` (event.code,
// for Alt+digit, where the key changes with the keyboard layout and on macOS).
// `mod` is Ctrl or Cmd. `ctrl` is the Control key itself on every platform.
// `web` replaces the binding in the browser build, or is null to skip it there:
// browsers keep Ctrl+W, Ctrl+T and Ctrl+Tab for themselves and page scripts cannot override them.

const APPLE_PLATFORMS = ['mac', 'iphone', 'ipad']
const TAB_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const platformName = () => (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()

export const isApplePlatform = () => APPLE_PLATFORMS.some((name) => platformName().includes(name))

// The Wails shell injects window.go; the web build never has it.
export const isDesktopApp = () => typeof window !== 'undefined' && Boolean(window.go)

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
    code: `Digit${position}`,
    position,
    listed: position === 1,
  })),
  { id: 'toggleSidebar', group: 'Navigation', label: 'Toggle sidebar', mod: true, key: 'b' },
  { id: 'focusSidebarSearch', group: 'Navigation', label: 'Search the sidebar', mod: true, shift: true, key: 'f' },
]

const byId = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

// The binding that applies in this build, or null when the build has none.
export const bindingFor = (shortcut, isDesktop = isDesktopApp()) => {
  if (isDesktop || shortcut.web === undefined) return shortcut
  if (!shortcut.web) return null
  return { id: shortcut.id, ...shortcut.web }
}

export const activeShortcuts = (isDesktop = isDesktopApp()) => (
  SHORTCUTS.map((shortcut) => ({ shortcut, binding: bindingFor(shortcut, isDesktop) })).filter(({ binding }) => binding)
)

export function matchesBinding(binding, event) {
  const usesControl = Boolean(binding.mod || binding.ctrl)
  if (binding.mod && !(event.ctrlKey || event.metaKey)) return false
  if (binding.ctrl && !event.ctrlKey) return false
  if (!usesControl && (event.ctrlKey || event.metaKey)) return false
  if (Boolean(binding.alt) !== event.altKey) return false
  if (Boolean(binding.shift) !== event.shiftKey) return false
  if (binding.code) return event.code === binding.code
  return event.key.toLowerCase() === binding.key
}

const KEY_NAMES = { enter: 'Enter', tab: 'Tab' }
const CODE_NAMES = { BracketLeft: '[', BracketRight: ']' }

const keyName = (binding) => {
  if (binding.code) return CODE_NAMES[binding.code] || binding.code.replace(/^(Digit|Key)/, '')
  return KEY_NAMES[binding.key] || binding.key.toUpperCase()
}

export function bindingLabel(binding, isApple = isApplePlatform()) {
  const parts = []
  if (binding.ctrl || (binding.mod && !isApple)) parts.push(isApple ? '⌃' : 'Ctrl')
  if (binding.mod && isApple) parts.push('⌘')
  if (binding.alt) parts.push(isApple ? '⌥' : 'Alt')
  if (binding.shift) parts.push(isApple ? '⇧' : 'Shift')
  parts.push(keyName(binding))
  return isApple ? parts.join('') : parts.join('+')
}

// Label for a shortcut in this build, or '' when it has none here.
export const shortcutLabelFor = (id) => {
  const shortcut = byId.get(id)
  const binding = shortcut && bindingFor(shortcut)
  return binding ? bindingLabel(binding) : ''
}

// Rows for the shortcuts dialog. Alt+1 to 9 collapse into one row.
export function shortcutRows() {
  return activeShortcuts()
    .filter(({ shortcut }) => shortcut.listed !== false)
    .map(({ shortcut, binding }) => ({
      id: shortcut.id,
      group: shortcut.group,
      label: shortcut.position ? 'Go to tab 1 to 9 (9 is the last tab)' : shortcut.label,
      keys: shortcut.position ? `${bindingLabel(binding).replace(/1$/, '')}1 to 9` : bindingLabel(binding),
    }))
}
