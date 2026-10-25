import english from '../../../../locales/en/environment.json'
import { messages } from './i18n/core'

const HIDDEN_VALUE = '••••••••'

const text = messages('environment', english, (t) => ({
  environment: {
    followed: (name, collection) => (collection ? t('environment.followedFor', { name, collection }) : t('environment.followed', { name })),
    inCollection: (name, collection) => t('environment.inCollection', { name, collection }),
    hiddenValue: HIDDEN_VALUE,
  },
}))

export const ENVIRONMENT_TEXT = text.environment
export const COLOR_TEXT = text.color
