import {
  AiCancel, AiCheck, AiComplete, AiKeyStored, AiPreview, AiRemoveKey, AiSaveKey,
} from '../../../wailsjs/go/main/App'
import { KIND_NETWORK, aiError } from '../ai/errors'

const answering = (run) => async (...args) => {
  try {
    return await run(...args)
  } catch (error) {
    return { text: '', error: aiError(KIND_NETWORK, error?.message || String(error)) }
  }
}

export const desktopAi = {
  holdsKeyOnDevice: false,
  keyStored: (provider) => AiKeyStored(provider),
  saveKey: (provider, key) => AiSaveKey(provider, key),
  removeKey: (provider) => AiRemoveKey(provider),
  preview: (provider, prompt, secrets) => AiPreview(provider, prompt, secrets),
  complete: answering((id, config, prompt, secrets, maxTokens) => AiComplete(id, config, prompt, secrets, maxTokens)),
  check: answering((id, config) => AiCheck(id, config)),
  cancel: (id) => AiCancel(id),
}
