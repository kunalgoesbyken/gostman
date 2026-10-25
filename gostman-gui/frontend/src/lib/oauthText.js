import english from '../../../../locales/en/oauth.json'
import { messages } from './i18n/core'

const text = messages('oauth', english, (t) => ({
  oauth: {
    fields: {
      issuerPlaceholder: 'https://login.example.com',
      authUrlPlaceholder: 'https://provider.example.com/authorize',
      deviceUrlPlaceholder: 'https://provider.example.com/device/code',
      tokenUrlPlaceholder: 'https://provider.example.com/token',
      scopePlaceholder: 'read write',
      headerPrefixPlaceholder: 'Bearer',
      callbackTitle: (url) => t('oauth.fields.callbackTitle', { url }),
    },
    discovered: (issuer) => t('oauth.discovered', { issuer }),
    expires: (expiry) => t('oauth.expires', { expiry }),
    expired: (expiry) => t('oauth.expired', { expiry }),
    popup: {
      refused: (reason) => t('oauth.popup.refused', { reason }),
      wrongIssuer: (received, expected) => t('oauth.popup.wrongIssuer', { received, expected }),
    },
  },
}))

export const OAUTH_TEXT = text.oauth