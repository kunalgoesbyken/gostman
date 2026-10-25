import english from '../../../../locales/en/attachment.json'
import { messages } from './i18n/core'

const PROXY_LIMIT = '4.5 MB'
const DESKTOP_LIMIT = '1 GB'

const text = messages('attachment', english, (t) => ({
  attachment: {
    tooLarge: (name, size, limit) => t('attachment.tooLarge', { name, size, limit, proxyLimit: PROXY_LIMIT, desktopLimit: DESKTOP_LIMIT }),
    get proxyTooLarge() {
      return t('attachment.proxyTooLarge', { proxyLimit: PROXY_LIMIT })
    },
  },
}))

export const ATTACHMENT_TEXT = text.attachment