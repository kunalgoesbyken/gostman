import english from '../../../../locales/en/sse.json'
import { messages } from './i18n/core'
import { formatNumber } from './i18n/format'

const text = messages('sse', english, (t) => ({
  sse: {
    shown: (shown, total) => t('sse.shown', { shown: formatNumber(shown), total: formatNumber(total) }),
    reconnecting: (seconds, attempt) => t('sse.reconnecting', { seconds, attempt }),
  },
}))

export const SSE_TEXT = text.sse
export const SSE_SETTINGS_TEXT = text.sseSettings
export const STATUS_TEXT = text.status
export const STREAM_END_TEXT = text.streamEnd