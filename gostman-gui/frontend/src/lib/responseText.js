import english from '../../../../locales/en/response.json'
import { messages } from './i18n/core'

const text = messages('response', english, (t) => ({
  response: {
    matchPosition: (index, count, capped) => t(capped ? 'response.matchPositionCapped' : 'response.matchPosition', { position: index + 1, count }),
    checksPassed: (passed, total) => t('response.checksPassed', { passed, total }),
  },
}))

export const CONSOLE_TEXT = text.console
export const VISUALIZE_TEXT = text.visualize
export const PREVIEW_TEXT = text.preview
export const ERROR_TITLES_TEXT = text.errorTitles
export const RESPONSE_TEXT = text.response
