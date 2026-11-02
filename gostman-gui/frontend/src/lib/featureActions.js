import { isAiEnabledNow } from './ai/session'
import { featureById, isMissingHere } from './featureIndex'
import { FEATURES_TEXT } from './featuresText'
import { openGit, useGitStore } from './gitSession'
import { focusAddressSoon } from './panes'
import { isDesktopApp } from './platform'
import { AUTH_PANEL, EXTRACT_PANEL, SETTINGS_PANEL, TESTS_PANEL, VARS_PANEL } from './requestSections'
import { SAMPLE_FOLDER_ID, protocolRequest, sampleBinaryRequest, sampleCollection, sampleFlow, sampleScanRequest } from './samples'
import { VIEW_HISTORY, VIEW_TABS } from './sidebarViews'
import { useAppStore } from '../store/appStore'

const CLI_INIT = 'gostman init'

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

  async function sendBinarySample() {
    await ensureSampleCollection()
    const request = sampleBinaryRequest()
    store().openRequestTab(request)
    await commands.sendRequest()
  }

  async function copyCommand(command) {
    try {
      await navigator.clipboard.writeText(command)
      store().showNotice(FEATURES_TEXT.copied(command))
    } catch {
      store().showNotice(FEATURES_TEXT.copyFailed(command))
    }
  }

  const openProtocolTab = (kind) => store().openRequestTab(protocolRequest(kind))

  const showPanel = (panel) => ({ run: () => store().setRequestPanel(panel) })

  const showSidebarView = (view) => ({ run: () => store().requestSidebarView(view) })

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
    negative: { run: () => store().openNegativeDialog() },
    import: { run: () => store().openImportDialog() },
    export: { run: openExport },
    share: { run: () => commands.share() },
    preferences: { run: () => store().openPreferencesDialog() },
    shortcuts: { run: () => store().openShortcutsDialog() },
    examples: { run: examples.open },
    folderSettings: { run: () => commands.collectionSettings() },
    git: { run: openGit, isAvailable: () => useGitStore.getState().state.hasFolder },
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
    aiMock: { run: () => commands.aiMock(), isAvailable: isAiEnabledNow },
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
    binary: { run: sendBinarySample },
    graphql: { run: () => openProtocolTab('graphql') },
    grpc: { run: () => openProtocolTab('grpc') },
    websocket: { run: () => openProtocolTab('websocket') },
    mcp: { run: () => openProtocolTab('mcp') },
    jwt: { run: () => {
      openProtocolTab('jwt')
      store().setRequestPanel(AUTH_PANEL)
    } },
    curl: { run: () => {
      store().newTab('')
      focusAddressSoon()
    } },
  }

  const tabs = {
    auth: showPanel(AUTH_PANEL),
    vars: showPanel(VARS_PANEL),
    extract: showPanel(EXTRACT_PANEL),
    tests: showPanel(TESTS_PANEL),
    settings: showPanel(SETTINGS_PANEL),
    history: showSidebarView(VIEW_HISTORY),
    openTabs: showSidebarView(VIEW_TABS),
  }

  const copies = {
    cliInit: { run: () => copyCommand(CLI_INIT) },
  }

  const handlers = { dialog: dialogs, command: commandHandlers, sample: samples, tab: tabs, copy: copies }

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

  return { canTry, open }
}
