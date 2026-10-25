import english from '../../../../locales/en/privacy.json'
import { messages } from './i18n/core'

const text = messages('privacy', english, () => ({
  privacy: {
    relayAddressPlaceholder: 'http://127.0.0.1:4030',
  },
}))

export const PRIVACY_TEXT = text.privacy
