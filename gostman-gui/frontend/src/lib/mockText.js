import english from '../../../../locales/en/mock.json'
import { messages } from './i18n/core'

const BODY_PLACEHOLDERS = ['request.params.id', 'request.query.x', 'request.header.x', 'request.body.json.path', '$guid', '$randomInt']

const text = messages('mock', english, (t) => ({
  mock: {
    specLoaded: (title, count) => t('mock.specLoaded', { title: title || t('mock.specUntitled'), count }),
    get bodyHint() {
      return t('mock.bodyHint', { placeholders: BODY_PLACEHOLDERS.map((name) => `{{${name}}}`).join(', ') })
    },
  },
}))

export const MOCK_TEXT = text.mock
