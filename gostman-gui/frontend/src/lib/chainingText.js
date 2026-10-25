import english from '../../../../locales/en/chaining.json'
import { messages } from './i18n/core'

const PATH_EXAMPLE = '$.data.id'

const text = messages('chaining', english, (t) => ({
  chaining: {
    get enterPath() {
      return t('chaining.enterPath', { example: PATH_EXAMPLE })
    },
  },
}))

export const CHAINING_TEXT = text.chaining