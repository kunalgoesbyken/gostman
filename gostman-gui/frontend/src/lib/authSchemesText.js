import english from '../../../../locales/en/authSchemes.json'
import { messages } from './i18n/core'

const TIMESTAMP_VARIABLE = '{{$timestamp}}'

const text = messages('authSchemes', english, (t) => ({
  authSchemes: {
    notes: {
      get jwt() {
        return t('authSchemes.notes.jwt', { timestamp: TIMESTAMP_VARIABLE })
      },
    },
  },
}))

export const AUTH_SCHEMES_TEXT = text.authSchemes