import { create } from 'zustand'
import { selectActiveTab, selectResolvedVariables, useAppStore } from '../../store/appStore'
import { requestSecrets, variableNames, variableSecrets } from './context'
import { KIND_CANCELED } from './errors'
import { PROVIDERS, providerById } from './providers'
import { BAD_REPLY, ReplyError } from './reply'
import {
  DEFAULT_AI_SETTINGS, forgetAiSettings, isConfigured, loadAiSettings, providerConfig, saveAiSettings,
} from './settings'
import { SCRIPT_POST, taskById } from './tasks'

export const STAGE_INPUT = 'input'
export const STAGE_PREVIEW = 'preview'
export const STAGE_RUNNING = 'running'
export const STAGE_PROPOSAL = 'proposal'
export const STAGE_ERROR = 'error'

const CHARACTERS_PER_TOKEN = 4
const OUTPUT_TOKENS = 3072
const NEEDS_RESPONSE = 'Send the request first so there is a response to work from.'
const NEEDS_TRUST = 'This folder is restricted. Trust it before generating scripts, because scripts from AI are untrusted until you review them.'

const INITIAL_STATE = {
  settings: DEFAULT_AI_SETTINGS,
  keyStored: false,
  settingsOpen: false,
  test: { status: 'idle', message: '' },
  dialog: null,
}

export const useAiStore = create(() => INITIAL_STATE)

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

export function createAiActions(backend, { importData }) {
  const ai = backend.ai

  const host = {
    openDraft: (draft) => app().openRequestTab(draft),
    updateRequest: (changes) => app().updateActiveRequest(changes),
    openRequest: (request) => app().openRequestTab(request),
    importDraft: (data) => importData(data),
  }

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
    patchDialog({ stage: STAGE_RUNNING, requestId: id, provider: state().settings.provider })
    const reply = await ai.complete(id, providerConfig(state().settings), dialog.preview.raw, source.secrets, OUTPUT_TOKENS)
    if (state().dialog?.requestId !== id) return
    if (reply.error) {
      patchDialog(reply.error.kind === KIND_CANCELED ? { stage: STAGE_INPUT, error: null } : { stage: STAGE_ERROR, error: reply.error.message })
      return
    }
    try {
      patchDialog({ stage: STAGE_PROPOSAL, proposal: task.parse(reply.text, source, dialog.input) })
    } catch (error) {
      patchDialog({ stage: STAGE_ERROR, error: error instanceof ReplyError ? error.message : BAD_REPLY })
    }
  }

  const submit = async () => {
    const dialog = state().dialog
    const task = taskById(dialog.taskId)
    const source = gatherSource()
    const raw = task.build(source, dialog.input)
    const scrubbed = await ai.preview(state().settings.provider, raw, source.secrets)
    const preview = { raw, scrubbed, tokens: estimateTokens(scrubbed) }
    patchDialog({ preview, stage: STAGE_PREVIEW })
    if (state().settings.skipPreview[task.id]) await run(state().dialog, source)
  }

  const confirmPreview = async (skipNextTime) => {
    const dialog = state().dialog
    if (skipNextTime) saveSettings({ skipPreview: { ...state().settings.skipPreview, [dialog.taskId]: true } })
    await run(dialog, gatherSource())
  }

  const needsInput = (task) => task.needsText || task.needsScriptKind || task.offersValues

  const refuse = (task) => {
    const source = gatherSource()
    if (task.needsResponse && !source.response) return NEEDS_RESPONSE
    if (task.requiresTrust && source.isRestricted) return NEEDS_TRUST
    return ''
  }

  const start = async (taskId, input = {}) => {
    const task = taskById(taskId)
    await refreshKey()
    if (!isUsable()) {
      patch({ settingsOpen: true })
      return
    }
    const problem = refuse(task)
    if (problem) {
      app().showAlert('AI', problem, 'OK', 'warning')
      return
    }
    patch({
      dialog: {
        taskId,
        input: { text: '', scriptKind: SCRIPT_POST, includeValues: Boolean(task.valuesByDefault), ...input },
        stage: STAGE_INPUT,
        preview: null,
        proposal: null,
        error: null,
        requestId: '',
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
    const { provider } = state().settings
    await ai.saveKey(provider, key, remember)
    await refreshKey(provider)
  }

  const removeKey = async () => {
    await ai.removeKey(state().settings.provider)
    await refreshKey()
  }

  const testConnection = async () => {
    const id = newId()
    patch({ test: { status: 'running', message: '' } })
    const reply = await ai.check(id, providerConfig(state().settings))
    patch({ test: reply.error ? { status: 'error', message: reply.error.message } : { status: 'ok', message: 'Connected' } })
  }

  const forgetEverything = async () => {
    await Promise.all(PROVIDERS.map((provider) => ai.removeKey(provider.id)))
    forgetAiSettings()
    patch({ ...INITIAL_STATE, settings: DEFAULT_AI_SETTINGS })
  }

  const selectProvider = async (provider) => {
    saveSettings({ provider, baseUrl: '', model: '' })
    patch({ test: INITIAL_STATE.test })
    await refreshKey(provider)
  }

  const load = async () => {
    patch({ settings: loadAiSettings() })
    await refreshKey()
  }

  return {
    load,
    start,
    submit,
    confirmPreview,
    cancel,
    accept,
    openLink,
    saveSettings,
    selectProvider,
    saveKey,
    removeKey,
    testConnection,
    forgetEverything,
    openSettings: () => patch({ settingsOpen: true }),
    closeSettings: () => patch({ settingsOpen: false, test: INITIAL_STATE.test }),
    setInput: (changes) => patchDialog({ input: { ...state().dialog.input, ...changes } }),
    backToInput: () => patchDialog({ stage: STAGE_INPUT, error: null, preview: null }),
    holdsKeyOnDevice: Boolean(ai.holdsKeyOnDevice),
  }
}
