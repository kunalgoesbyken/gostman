import english from '../../../../locales/en/exampleActions.json'
import { messages } from './i18n/core'

const text = messages('exampleActions', english, (t) => ({
  exampleActions: {
    saved: (example, request) => t('exampleActions.saved', { example, request }),
  },
}))

export const EXAMPLE_ACTIONS_TEXT = text.exampleActions
