import english from '../../../../locales/en/timeline.json'
import { messages } from './i18n/core'

const text = messages('timeline', english, (t) => ({
  timeline: {
    secretSkipped: (name, connection) => t('timeline.secretSkipped', { name, connection }),
  },
}))

export const TIMELINE_TEXT = text.timeline
