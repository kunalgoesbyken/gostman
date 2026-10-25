import english from '../../../../locales/en/variables.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const text = messages('variables', english, (t) => ({
  variables: {
    through: (names) => t('variables.through', { names: formatList(names, 'unit') }),
  },
}))

export const VARIABLE_TEXT = text.variables
