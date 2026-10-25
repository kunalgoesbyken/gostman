import english from '../../../../locales/en/jsonFormat.json'
import { messages } from './i18n/core'

const REFERENCE_EXAMPLE = '{{variable}}'
const REFERENCE_CLOSE = '}}'

const text = messages('jsonFormat', english, (t) => ({
  jsonFormat: {
    get unclosedReference() {
      return t('jsonFormat.unclosedReference', { reference: REFERENCE_EXAMPLE, closer: REFERENCE_CLOSE })
    },
  },
}))

export const JSON_FORMAT_TEXT = text.jsonFormat