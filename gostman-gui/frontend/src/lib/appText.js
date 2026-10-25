import english from '../../../../locales/en/app.json'
import { messages } from './i18n/core'

const text = messages('app', english, (t) => ({
  app: {
    labelled: (label, name) => t('app.labelled', { label, name }),
  },
}))

export const APP_TEXT = text.app
