import english from '../../../../locales/en/cookies.json'
import { messages } from './i18n/core'
import { RESPONSE_TEXT } from './responseText'

const text = messages('cookies', english, () => ({
  cookies: {
    get title() {
      return RESPONSE_TEXT.tabs.cookies
    },
    get columns() {
      return RESPONSE_TEXT.columns
    },
    get session() {
      return RESPONSE_TEXT.sessionCookie
    },
  },
}))

export const COOKIES_TEXT = text.cookies