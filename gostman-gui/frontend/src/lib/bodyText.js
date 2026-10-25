import english from '../../../../locales/en/body.json'
import { messages } from './i18n/core'

const VARIABLES_EXAMPLE = '{{variables}}'

const text = messages('body', english, (t) => ({
  body: {
    formatTitle: (type, chord) => t('body.formatTitle', { type, chord, example: VARIABLES_EXAMPLE }),
    cannotFormatAt: (type, { line, column, message }) => t('body.cannotFormatAt', { type, line, column, message }),
    cannotFormat: (type, { message }) => t('body.cannotFormat', { type, message }),
  },
}))

export const BODY_TEXT = text.body