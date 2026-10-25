import english from '../../../../locales/en/socketSessions.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const text = messages('socketSessions', english, (t) => ({
  socketSessions: {
    undefinedVariables: (names) => t('socketSessions.undefinedVariables', { names: formatList(names, 'unit') }),
  },
}))

export const SOCKET_SESSIONS_TEXT = text.socketSessions