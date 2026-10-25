import english from '../../../../locales/en/preferences.json'
import { messages } from './i18n/core'

const text = messages('preferences', english, (t) => ({
  preferences: {
    languageHelpParts: (link) => t.parts('preferences.languageHelp', { link }),
    languageTranslateParts: (link) => t.parts('preferences.languageTranslate', { link }),
    theme: {
      colorLabel: (surface, role) => t('preferences.theme.colorLabel', { surface, role }),
      hexLabel: (surface, role) => t('preferences.theme.hexLabel', { surface, role }),
    },
  },
}))

export const PREFERENCES_TEXT = text.preferences
