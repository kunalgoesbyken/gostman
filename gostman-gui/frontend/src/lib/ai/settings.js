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
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return DEFAULT_AI_SETTINGS
    return { ...DEFAULT_AI_SETTINGS, ...stored, skipPreview: { ...stored.skipPreview } }
  } catch {
    return DEFAULT_AI_SETTINGS
  }
}

export function saveAiSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    return
  }
}

export function forgetAiSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export const providerConfig = ({ provider, baseUrl, model, allowInsecure }) => ({ provider, baseUrl, model, allowInsecure })

export const isConfigured = (settings) => settings.enabled && settings.consented && settings.model.trim() !== ''
