import english from '../../../../locales/en/realtime.json'
import { messages } from './i18n/core'

const REFUSALS = {
  1: 'refusedVersion',
  2: 'refusedIdentifier',
  3: 'refusedUnavailable',
  4: 'refusedCredentials',
  5: 'refusedUnauthorized',
}

const text = messages('realtime', english, (t) => ({
  realtime: {
    browser: {
      describeClose: (code, reason, wasOpen) => t(`realtime.browser.${wasOpen ? 'closed' : 'notConnected'}${reason ? 'WithReason' : ''}`, { code, reason }),
    },
    mqtt: {
      refused: (code) => t(`realtime.mqtt.${REFUSALS[code] ?? 'refusedOther'}`, { code }),
    },
  },
}))

export const REALTIME_TEXT = text.realtime