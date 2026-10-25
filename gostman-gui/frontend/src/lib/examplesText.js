import english from '../../../../locales/en/examples.json'
import { messages } from './i18n/core'

const text = messages('examples', english, (t) => ({
  examples: {
    bodyTooLarge: (size, limit) => t('examples.bodyTooLarge', { size, limit }),
    summary: (contentType, size) => `${contentType} · ${size}`,
  },
}))

export const EXAMPLES_TEXT = text.examples