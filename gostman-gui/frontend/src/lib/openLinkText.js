import english from '../../../../locales/en/openLink.json'
import { messages } from './i18n/core'

const text = messages('openLink', english, () => ({
  openLink: {
    builderPlaceholder: 'https://example.com/collection.json',
  },
}))

export const OPEN_LINK_TEXT = text.openLink
