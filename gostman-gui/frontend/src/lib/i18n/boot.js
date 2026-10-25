import { getPreferences } from '../preferences'
import { ENGLISH, installCatalogue } from './core'
import { loadCatalogue, resolveLanguage } from './languages'

let booting = null

async function installPreferred() {
  const language = resolveLanguage(getPreferences().language)
  if (language === ENGLISH) return ENGLISH
  try {
    installCatalogue(language, await loadCatalogue(language))
    return language
  } catch {
    installCatalogue(ENGLISH, {})
    return ENGLISH
  }
}

export function bootLanguage() {
  booting ||= installPreferred()
  return booting
}
