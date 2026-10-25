import english from '../../../../locales/en/command.json'
import { messages } from './i18n/core'
import { FOLDER_SETTINGS_TEXT } from './folderSettingsText'
import { HISTORY_TEXT, SIDEBAR_TEXT } from './sidebarText'
import { MOCK_TEXT } from './mockText'
import { REQUEST_BAR_TEXT } from './requestBarText'
import { SHORTCUT_TEXT } from './shortcutText'
import { SPEC_ALERTS } from './specText'
import { TAB_TEXT } from './treeText'

const text = messages('command', english, (t) => ({
  command: {
    sections: {
      get command() {
        return t('command.heading')
      },
      get history() {
        return SIDEBAR_TEXT.history
      },
    },
    get untitled() {
      return REQUEST_BAR_TEXT.untitled
    },
    get shortcuts() {
      return SHORTCUT_TEXT.title
    },
    get escapeKey() {
      return SHORTCUT_TEXT.keys.names.escape
    },
    commands: {
      newRequest: {
        get label() {
          return SIDEBAR_TEXT.newRequest
        },
      },
      generateCode: {
        get label() {
          return REQUEST_BAR_TEXT.codeHint
        },
      },
      closeOtherTabs: {
        get label() {
          return TAB_TEXT.closeOthers
        },
      },
      closeSavedTabs: {
        get label() {
          return TAB_TEXT.closeSaved
        },
      },
      toggleSidebar: {
        get label() {
          return SIDEBAR_TEXT.toggle
        },
      },
      shortcuts: {
        get label() {
          return SHORTCUT_TEXT.title
        },
      },
      newFolder: {
        get label() {
          return SIDEBAR_TEXT.newFolder
        },
      },
      runCollection: {
        get label() {
          return SIDEBAR_TEXT.runRequests
        },
      },
      collectionSettings: {
        get label() {
          return FOLDER_SETTINGS_TEXT.collectionTitle
        },
        get description() {
          return FOLDER_SETTINGS_TEXT.collectionDescription
        },
        get keywords() {
          return t('command.settingsKeywords')
        },
      },
      allCollectionsSettings: {
        get label() {
          return FOLDER_SETTINGS_TEXT.allCollectionsTitle
        },
        get description() {
          return FOLDER_SETTINGS_TEXT.allCollectionsDescription
        },
        get keywords() {
          return t('command.settingsKeywords')
        },
      },
      mockServer: {
        get label() {
          return MOCK_TEXT.title
        },
      },
      lintSpec: {
        get label() {
          return SPEC_ALERTS.lintTitle
        },
      },
      clearHistory: {
        get label() {
          return HISTORY_TEXT.clear
        },
      },
    },
  },
}))

export const COMMAND_TEXT = text.command
