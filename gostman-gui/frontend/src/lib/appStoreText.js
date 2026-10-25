import english from '../../../../locales/en/appStore.json'
import { messages } from './i18n/core'

const text = messages('appStore', english, (t) => ({
  appStore: {
    saveFailed: (reason) => t('appStore.saveFailed', { reason }),
  },
}))

export const APP_STORE_TEXT = text.appStore
