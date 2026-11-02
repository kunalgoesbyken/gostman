import { featureById, isMissingHere } from './featureIndex'
import { FEATURES_TEXT } from './featuresText'
import { openGit, useGitStore } from './gitSession'
import { focusAddressSoon } from './panes'
import { isDesktopApp } from './platform'
import { AUTH_PANEL, EXTRACT_PANEL, SETTINGS_PANEL, TESTS_PANEL, VARS_PANEL } from './requestSections'
import { SAMPLE_FOLDER_ID, protocolRequest, sampleCollection, sampleFlow, sampleScanRequest } from './samples'
import { VIEW_FLOWS, VIEW_HISTORY, VIEW_TABS } from './sidebarViews'
import { useAppStore } from '../store/appStore'

const PANELS = { auth: AUTH_PANEL, vars: VARS_PANEL, extract: EXTRACT_PANEL, tests: TESTS_PANEL, settings: SETTINGS_PANEL }
const SIDEBAR_VIEWS = { history: VIEW_HISTORY, openTabs: VIEW_TABS, flows: VIEW_FLOWS }

const store = () => useAppStore.getState()

export function createFeatureActions({ backend, commands, monitors, mock, capture, loadTest, examples, flows, hasStorage, openExport, saveRequests }) {
  async function ensureSampleCollection() {
    if (store().folders.some((folder) => folder.id === SAMPLE_FOLDER_ID)) return
    const { folder, requests } = sampleCollection()
    store().mergeFolders([folder])
    store().upsertRequests(await saveRequests(requests))
    store().showNotice(FEATURES_TEXT.samplesAdded)
  }

  async function addScanSample() {
    await ensureSampleCollection()
    store().upsertRequests(await saveRequests([sampleScanRequest()]))
  }

  const openProtocolTab = (kind) => store().openRequestTab(protocolRequest(kind))

  const gitAvailable = () => useGitStore.getState().state.hasFolder

  const dialogs = {
    monitors: { run: () => monitors.open() },
    environments: { run: () => store().openEnvironmentDialog() },
    cookies: { run: () => store().openCookiesDialog() },
    network: { run: () => store().openSettingsDialog(), isAvailable: () => Boolean(backend.network) },
    mock: { run: mock.open, isAvailable: () => mock.isAvailable },
    capture: { run: capture.open, isAvailable: () => capture.isAvailable },
    loadTest: { run: loadTest.open, isAvailable: () => loadTest.isAvailable },
    runner: { run: () => store().openRunner() },
    scan: { run: () => store().openScanDialog() },
    import: { run: () => store().openImportDialog() },
    export: { run: openExport },
    share: { run: () => commands.share() },
    preferences: { run: () => store().openPreferencesDialog() },
    shortcuts: { run: () => store().openShortcutsDialog() },
    examples: { run: examples.open },
    folderSettings: { run: () => commands.collectionSettings() },
    git: { run: openGit, isAvailable: gitAvailable },
  }

  const commandHandlers = {
    newRequest: { run: () => commands.newRequest() },
    newFolder: { run: () => commands.newFolder() },
    generateCode: { run: () => commands.generateCode() },
    sendSample: { run: () => commands.sendSample() },
    lintSpec: { run: () => commands.lintSpec() },
    diffSpecs: { run: () => commands.diffSpecs() },
    commandPalette: { run: () => store().openCommandPalette() },
    workspaceSwitcher: { run: () => commands.workspaceSwitcher(), isAvailable: () => hasStorage },
    aiSettings: { run: () => commands.aiSettings() },
  }

  const samples = {
    collection: { run: ensureSampleCollection },
    send: { run: () => commands.sendSample() },
    scan: { run: async () => {
      await addScanSample()
      store().openScanDialog()
    } },
    flow: { run: async () => {
      await ensureSampleCollection()
      await flows.addSample(sampleFlow())
    } },
    graphql: { run: () => openProtocolTab('graphql') },
    grpc: { run: () => openProtocolTab('grpc') },
    websocket: { run: () => openProtocolTab('websocket') },
    mcp: { run: () => openProtocolTab('mcp') },
    curl: { run: () => {
      store().newTab('')
      focusAddressSoon()
    } },
  }

  const tabs = Object.fromEntries([
    ...Object.entries(PANELS).map(([id, panel]) => [id, { run: () => store().setRequestPanel(panel) }]),
    ...Object.entries(SIDEBAR_VIEWS).map(([id, view]) => [id, { run: () => store().requestSidebarView(view) }]),
  ])

  const handlers = { dialog: dialogs, command: commandHandlers, sample: samples, tab: tabs }

  const actionOf = (feature, preferSample) => {
    if (!preferSample) return feature?.action
    if (feature?.sample) return { type: 'sample', id: feature.sample }
    return feature?.action?.type === 'dialog' ? null : feature?.action
  }

  const handlerOf = (feature, preferSample) => {
    const action = actionOf(feature, preferSample)
    return action ? handlers[action.type]?.[action.id] ?? null : null
  }

  function canTry(id, preferSample = false) {
    const feature = featureById(id)
    const handler = handlerOf(feature, preferSample)
    if (!handler || isMissingHere(feature, isDesktopApp())) return false
    return handler.isAvailable ? handler.isAvailable() : true
  }

  async function open(id, preferSample = false) {
    store().closeExplore()
    if (!canTry(id, preferSample)) {
      store().openExplore(id)
      return
    }
    await handlerOf(featureById(id), preferSample).run()
  }

  return {
    canTry,
    open,
  }
}
