import english from '../../../../locales/en/capture.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const text = messages('capture', english, (t) => ({
  captureAction: {
    withheld: (headers) => t('captureAction.withheld', { headers: formatList(headers, 'unit') }),
  },
}))

export const CAPTURE_TEXT = text.capture
export const CAPTURE_ACTION_TEXT = text.captureAction
