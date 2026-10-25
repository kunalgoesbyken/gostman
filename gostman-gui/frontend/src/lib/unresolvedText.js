import english from '../../../../locales/en/unresolved.json'
import { messages } from './i18n/core'

const braced = (name) => `{{${name}}}`

const text = messages('unresolved', english, (t) => ({
  unresolved: {
    placeholder: braced,
    extractedBy: (name, request, isOnly) => (
      isOnly ? t('unresolved.extractedByOnly', { request }) : t('unresolved.extractedBy', { reference: braced(name), request })
    ),
    define: (name) => t('unresolved.define', { reference: braced(name) }),
  },
}))

export const UNRESOLVED_TEXT = text.unresolved