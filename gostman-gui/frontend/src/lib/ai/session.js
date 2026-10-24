import { create } from 'zustand'
import { selectActiveTab, selectResolvedVariables, useAppStore } from '../../store/appStore'
import { AI_TEXT } from '../aiText'
import { requestSecrets, variableNames, variableSecrets } from './context'
import { KIND_CANCELED, errorMessage } from './errors'
import { PROVIDERS, providerById } from './providers'
import { ReplyError } from './reply'
import {
  DEFAULT_AI_SETTINGS, forgetAiSettings, isAiEnabled, isConfigured, loadAiSettings, providerConfig, saveAiSettings,
} from './settings'
import { SECTION_AI, selectPreferencesSection } from '../preferencesSection'
import { SCRIPT_POST, taskById } from './tasks'

export const STAGE_INPUT = 'input'
export const STAGE_PREVIEW = 'preview'
export const STAGE_RUNNING = 'running'
export const STAGE_PROPOSAL = 'proposal'
export const STAGE_ERROR = 'error'

export const STATUS_IDLE = 'idle'
export const STATUS_RUNNING = 'running'
export const STATUS_OK = 'ok'
export const STATUS_ERROR = 'error'

const CHARACTERS_PER_TOKEN = 4
const OUTPUT_TOKENS = 8192

const IDLE = { status: STATUS_IDLE, message: '' }
const NO_MODELS = { status: STATUS_IDLE, list: [], message: '' }

const INITIAL_STATE = {
  settings: DEFAULT_AI_SETTINGS,
  keyStored: false,
  test: IDLE,
  models: NO_MODELS,
  dialog: null,
}

export const useAiStore = create(() => INITIAL_STATE)

export const useAiEnabled = () => useAiStore((current) => isAiEnabled(current.settings))

const state = () => useAiStore.getState()
const patch = (changes) => useAiStore.setState(changes)
const patchDialog = (changes) => useAiStore.setState((current) => (current.dialog ? { dialog: { ...current.dialog, ...changes } } : current))
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)
const newId = () => crypto.randomUUID()

const estimateTokens = (prompt) => Math.ceil((prompt.system.length + prompt.user.length) / CHARACTERS_PER_TOKEN)

function gatherSource() {
  const snapshot = app()
  const tab = selectActiveTab(snapshot)
  const resolved = selectResolvedVariables(snapshot)
  return {
    request: tab.request,
    response: tab.response,
    requests: snapshot.requests,
    variableNames: variableNames(resolved),
    folderNames: snapshot.folders.map((folder) => folder.name),
    isRestricted: snapshot.isRestricted,
    secrets: [...requestSecrets(tab.request), ...variableSecrets(resolved)],
  }
}

export function createAiActions(backend, { importData, openapi }) {
  const ai = backend.ai

  const host = {
    openDraft: (draft) => app().openRequestTab(draft),
    updateRequest: (changes) => app().updateActiveRequest(changes),
    openRequest: (request) => app().openRequestTab(request),
    importDraft: (data) => importData(data),
    importSpec: (result) => openapi.importSpec(result),
  }

  const tools = { readSpec: (source) => openapi.read(source) }

  const isCurrent = (id) => state().dialog?.requestId === id

  const refreshKey = async (provider = state().settings.provider) => {
    patch({ keyStored: await ai.keyStored(provider) })
  }

  const saveSettings = (changes) => {
    const settings = { ...state().settings, ...changes }
    saveAiSettings(settings)
    patch({ settings })
  }

  const isUsable = () => {
    const { settings, keyStored } = state()
    return isConfigured(settings) && (keyStored || !providerById(settings.provider).keyRequired)
  }

  const run = async (dialog, source) => {
    const task = taskById(dialog.taskId)
    const id = newId()
    patchDialog({ stage: STAGE_RUNNING, requestId: id, waiting: '', provider: state().settings.provider })
    const reply = await ai.complete(id, providerConfig(state().settings), dialog.preview.raw, source.secrets, OUTPUT_TOKENS)
    if (!isCurrent(id)) return
    if (reply.error) {
      patchDialog(reply.error.kind === KIND_CANCELED ? { stage: STAGE_INPUT, error: null } : { stage: STAGE_ERROR, error: errorMessage(reply.error) })
      return
    }
    try {
      patchDialog({ stage: STAGE_PROPOSAL, proposal: task.parse(reply.text, source, dialog.input) })
    } catch (error) {
      patchDialog({ stage: STAGE_ERROR, error: error instanceof ReplyError ? error.message : AI_TEXT.badReply })
    }
  }

  const proposeLocally = async (task, input) => {
    const id = newId()
    patchDialog({ stage: STAGE_RUNNING, requestId: id, waiting: AI_TEXT.readingSpec })
    const proposal = await task.local(input, tools)
    if (!isCurrent(id)) return { handled: true }
    if (proposal) patchDialog({ stage: STAGE_PROPOSAL, proposal })
    return { handled: Boolean(proposal) }
  }

  const submit = async () => {
    const dialog = state().dialog
    const task = taskById(dialog.taskId)
    if (task.local && !dialog.input.done?.length && (await proposeLocally(task, dialog.input)).handled) return
    const problem = task.refuse?.(dialog.input)
    if (problem) {
      patchDialog({ stage: STAGE_ERROR, error: problem })
      return
    }
    const source = gatherSource()
    const raw = { ...task.build(source, dialog.input), schema: task.schema }
    const scrubbed = await ai.preview(state().settings.provider, raw, source.secrets)
    const preview = { raw, scrubbed, tokens: estimateTokens(scrubbed), includeValues: task.offersValues ? dialog.input.includeValues : null }
    patchDialog({ preview, stage: STAGE_PREVIEW })
    if (state().settings.skipPreview[task.id]) await run(state().dialog, source)
  }

  const confirmPreview = async (skipNextTime) => {
    const dialog = state().dialog
    if (skipNextTime) saveSettings({ skipPreview: { ...state().settings.skipPreview, [dialog.taskId]: true } })
    await run(dialog, gatherSource())
  }

  const continueProposal = async () => {
    const { input, proposal } = state().dialog
    patchDialog({ input: { ...input, ...proposal.next }, proposal: null })
    await submit()
  }

  const needsInput = (task) => task.needsText || task.needsScriptKind || task.offersValues

  const refuse = (task) => {
    const source = gatherSource()
    if (task.needsResponse && !source.response) return AI_TEXT.needsResponse
    if (task.requiresTrust && source.isRestricted) return AI_TEXT.needsTrust
    return ''
  }

  const start = async (taskId, input = {}) => {
    if (!isAiEnabled(state().settings)) return
    const task = taskById(taskId)
    await refreshKey()
    if (!isUsable()) {
      openSettings()
      return
    }
    const problem = refuse(task)
    if (problem) {
      app().showAlert(AI_TEXT.name, problem, AI_TEXT.ok, 'warning')
      return
    }
    patch({
      dialog: {
        taskId,
        input: { text: '', scriptKind: SCRIPT_POST, includeValues: Boolean(task.valuesByDefault), ...input },
        note: task.note?.(gatherSource()) || '',
        stage: STAGE_INPUT,
        preview: null,
        proposal: null,
        error: null,
        requestId: '',
        waiting: '',
        provider: state().settings.provider,
      },
    })
    if (!needsInput(task)) await submit()
  }

  const cancel = async () => {
    const id = state().dialog?.requestId
    patch({ dialog: null })
    if (id) await ai.cancel(id)
  }

  const accept = () => {
    state().dialog?.proposal?.apply?.(host)
    patch({ dialog: null })
  }

  const openLink = (link) => {
    link.open(host)
    patch({ dialog: null })
  }

  const saveKey = async (key, remember) => {
    const { settings } = state()
    try {
      await ai.saveKey(providerConfig(settings), key, remember)
    } catch (error) {
      patch({ test: { status: STATUS_ERROR, message: messageOf(error) } })
    }
    await refreshKey(settings.provider)
  }

  const removeKey = async () => {
    await ai.removeKey(state().settings.provider)
    await refreshKey()
  }

  const testConnection = async () => {
    patch({ test: { status: STATUS_RUNNING, message: '' } })
    const reply = await ai.check(newId(), providerConfig(state().settings))
    patch({ test: reply.error ? { status: STATUS_ERROR, message: errorMessage(reply.error) } : { status: STATUS_OK, message: AI_TEXT.connected } })
  }

  const listModels = async () => {
    const { provider } = state().settings
    patch({ models: { ...NO_MODELS, status: STATUS_RUNNING } })
    const reply = await ai.models(newId(), providerConfig(state().settings))
    if (state().settings.provider !== provider) return
    patch({
      models: reply.error
        ? { ...NO_MODELS, status: STATUS_ERROR, message: errorMessage(reply.error) }
        : { status: STATUS_OK, list: reply.models || [], message: '' },
    })
  }

  const listLocalModels = () => (providerById(state().settings.provider).local ? listModels() : undefined)

  const forgetEverything = async () => {
    await Promise.all(PROVIDERS.map((provider) => ai.removeKey(provider.id)))
    forgetAiSettings()
    patch({ ...INITIAL_STATE, settings: DEFAULT_AI_SETTINGS })
  }

  const selectProvider = async (provider) => {
    saveSettings({ provider, baseUrl: '', model: '' })
    patch({ test: IDLE, models: NO_MODELS })
    await refreshKey(provider)
    await listLocalModels()
  }

  const openSettings = () => {
    selectPreferencesSection(SECTION_AI)
    app().openPreferencesDialog()
  }

  const load = async () => {
    patch({ settings: loadAiSettings() })
    await refreshKey()
  }

  const setInput = (changes) => {
    const restart = 'text' in changes ? { done: [], folderName: '' } : {}
    patchDialog({ input: { ...state().dialog.input, ...changes, ...restart } })
  }

  return {
    load,
    start,
    submit,
    confirmPreview,
    continueProposal,
    cancel,
    accept,
    openLink,
    saveSettings,
    selectProvider,
    saveKey,
    removeKey,
    testConnection,
    listModels,
    forgetEverything,
    openSettings,
    prepareSettings: listLocalModels,
    leaveSettings: () => patch({ test: IDLE }),
    askBeforeEveryAction: () => saveSettings({ skipPreview: {} }),
    setInput,
    backToInput: () => patchDialog({ stage: STAGE_INPUT, error: null, preview: null }),
    holdsKeyOnDevice: Boolean(ai.holdsKeyOnDevice),
  }
}
