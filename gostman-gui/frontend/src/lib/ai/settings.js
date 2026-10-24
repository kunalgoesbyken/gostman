import { isPlainObject } from '../dataUtils'
import { readStoredJSON, removeStored, writeStored } from '../storage'
import { PROVIDER_ANTHROPIC } from './providers'

const STORAGE_KEY = 'gostman-ai'

export const DEFAULT_AI_SETTINGS = {
  enabled: false,
  consented: false,
  provider: PROVIDER_ANTHROPIC,
  baseUrl: '',
  model: '',
  allowInsecure: false,
  skipPreview: {},
}

export function loadAiSettings() {
  const stored = readStoredJSON(STORAGE_KEY, null)
  if (!isPlainObject(stored)) return DEFAULT_AI_SETTINGS
  return { ...DEFAULT_AI_SETTINGS, ...stored, skipPreview: { ...stored.skipPreview } }
}

export const saveAiSettings = (settings) => writeStored(STORAGE_KEY, JSON.stringify(settings))

export const forgetAiSettings = () => removeStored(STORAGE_KEY)

export const providerConfig = ({ provider, baseUrl, model, allowInsecure }) => ({ provider, baseUrl, model, allowInsecure })

export const isAiEnabled = (settings) => settings.enabled && settings.consented

export const isConfigured = (settings) => isAiEnabled(settings) && settings.model.trim() !== ''
