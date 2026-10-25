import { FOLDER_SETTINGS_TEXT } from './folderSettingsText'
import { HISTORY_TEXT, SIDEBAR_TEXT } from './sidebarText'
import { MOCK_TEXT } from './mockText'
import { REQUEST_BAR_TEXT } from './requestBarText'
import { SHORTCUT_TEXT } from './shortcutText'
import { SPEC_ALERTS } from './specText'
import { TAB_TEXT } from './treeText'

const HEADING = 'Commands'

export const COMMAND_TEXT = {
  title: 'Command palette',
  heading: HEADING,
  sections: { command: HEADING, request: 'Requests', history: SIDEBAR_TEXT.history },
  searchCommands: 'Search commands',
  searchRequests: 'Search requests',
  commandsPlaceholder: 'Type a command or a request name',
  requestsPlaceholder: 'Go to a request or history entry',
  results: 'Results',
  nothingMatches: 'Nothing matches',
  sentEarlier: 'Sent earlier',
  untitled: REQUEST_BAR_TEXT.untitled,
  shortcuts: SHORTCUT_TEXT.title,
  escapeKey: SHORTCUT_TEXT.keys.names.escape,
  switchEnvironment: (name) => `Switch environment: ${name}`,
  switchEnvironmentDescription: "Use this environment's variables",
  commands: {
    sendRequest: { label: 'Send request', description: 'Send the request in the current tab' },
    newRequest: { label: SIDEBAR_TEXT.newRequest, description: 'Open a new empty tab' },
    saveRequest: { label: 'Save request', description: 'Save the request in the current tab' },
    duplicateRequest: { label: 'Duplicate request', description: 'Save a copy of the current request' },
    copyRequest: { label: 'Copy request', description: 'Copy the saved request to paste it into a folder' },
    pasteRequest: { label: 'Paste request', description: 'Paste the copied request or folder next to the current request' },
    generateCode: { label: REQUEST_BAR_TEXT.codeHint, description: 'Show the current request as code' },
    closeTab: { label: 'Close tab', description: 'Close the current tab' },
    closeOtherTabs: { label: TAB_TEXT.closeOthers, description: 'Keep only the current tab' },
    closeSavedTabs: { label: TAB_TEXT.closeSaved, description: 'Close every tab without unsaved changes' },
    keepTab: { label: 'Keep preview tab open', description: 'Turn the preview tab into a regular tab' },
    reopenTab: { label: 'Reopen closed tab', description: 'Bring back the tab you closed last' },
    toggleSidebar: { label: SIDEBAR_TEXT.toggle, description: 'Show or hide collections and history' },
    shortcuts: { label: SHORTCUT_TEXT.title, description: 'See every shortcut' },
    newFolder: { label: SIDEBAR_TEXT.newFolder, description: 'Create a folder at the top level' },
    runCollection: { label: SIDEBAR_TEXT.runRequests, description: 'Run the whole collection or one folder, with its checks and scripts' },
    collectionSettings: { label: FOLDER_SETTINGS_TEXT.collectionTitle, description: FOLDER_SETTINGS_TEXT.collectionDescription },
    allCollectionsSettings: { label: FOLDER_SETTINGS_TEXT.allCollectionsTitle, description: FOLDER_SETTINGS_TEXT.allCollectionsDescription },
    examples: { label: 'Request examples', description: 'See the saved responses of the current request' },
    mockServer: { label: MOCK_TEXT.title, description: 'Serve saved examples on a local port' },
    capture: { label: 'Capture traffic', description: "Forward an app's calls to its API and save them as requests" },
    cookies: { label: 'Manage cookies', description: 'See and delete stored cookies' },
    environments: { label: 'Manage environments', description: 'Create environments and edit their variables, collection variables and globals' },
    network: { label: 'Network settings', description: 'Proxy and certificates' },
    import: { label: 'Import data', description: 'Import Postman, Insomnia, Bruno, OpenAPI, HAR and other files' },
    lintSpec: { label: SPEC_ALERTS.lintTitle, description: 'Check the imported OpenAPI spec for problems' },
    export: { label: 'Export data', description: 'Export collections and environments' },
    share: { label: 'Share collection', description: 'Create an encrypted link or file, no account needed' },
    clearHistory: { label: HISTORY_TEXT.clear, description: 'Delete every history entry' },
  },
}
