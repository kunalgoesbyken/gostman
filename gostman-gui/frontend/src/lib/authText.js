import english from '../../../../locales/en/auth.json'
import { messages } from './i18n/core'

const FIELDS_EXAMPLE = '{{variables}}'

const text = messages('auth', english, (t) => ({
  auth: {
    keyPlaceholder: 'X-API-Key',
    get fieldsNote() {
      return t('auth.fieldsNote', { example: FIELDS_EXAMPLE })
    },
  },
}))

export const AUTH_TEXT = text.auth