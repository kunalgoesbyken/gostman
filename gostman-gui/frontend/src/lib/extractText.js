import english from '../../../../locales/en/extract.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const VARIABLE_EXAMPLE = '{{variable_name}}'

const text = messages('extract', english, (t) => ({
  extract: {
    get summary() {
      return t('extract.summary', { example: VARIABLE_EXAMPLE })
    },
    savedTo: {
      session: (names) => t('extract.savedTo.session', { names: formatList(names, 'unit') }),
      environment: (names) => t('extract.savedTo.environment', { names: formatList(names, 'unit') }),
    },
  },
}))

export const EXTRACT_TEXT = text.extract