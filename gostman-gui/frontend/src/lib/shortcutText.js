import english from '../../../../locales/en/shortcut.json'
import { messages } from './i18n/core'

const KEY_NAMES = {
  plain: { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' },
  apple: { ctrl: '⌃', meta: '⌘', alt: '⌥', shift: '⇧' },
  names: {
    enter: 'Enter',
    tab: 'Tab',
    space: 'Space',
    escape: 'Esc',
    home: 'Home',
    end: 'End',
    backspace: 'Backspace',
    delete: 'Delete',
    pageup: 'Page Up',
    pagedown: 'Page Down',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
  },
}

const text = messages('shortcut', english, (t) => ({
  shortcut: {
    get groups() {
      return {
        General: t('shortcut.groups.general'),
        Request: t('shortcut.groups.request'),
        Tabs: t('shortcut.groups.tabs'),
        Navigation: t('shortcut.groups.navigation'),
      }
    },
    conflict: (chord, label) => t('shortcut.conflict', { chord, label }),
    keys: KEY_NAMES,
  },
}))

export const SHORTCUT_TEXT = text.shortcut
