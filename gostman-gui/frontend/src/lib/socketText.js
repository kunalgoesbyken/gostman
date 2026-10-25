import english from '../../../../locales/en/socket.json'
import { messages } from './i18n/core'
import { formatList, formatNumber } from './i18n/format'

const text = messages('socket', english, (t) => ({
  socket: {
    socketIoPathPlaceholder: '/socket.io/',
    socketIoAuthPlaceholder: '{"token": "{{token}}"}',
    truncated: (shown, total) => t('socket.truncated', { shown: formatNumber(shown), total: formatNumber(total) }),
    dropped: (dropped, limit) => t('socket.dropped', { dropped: formatNumber(dropped), limit: formatNumber(limit) }),
    unsentHeaders: (names) => t('socket.unsentHeaders', { names: formatList(names, 'unit') }),
    composer: (shortcut) => t('socket.composer', { shortcut }),
  },
}))

export const SOCKET_TEXT = text.socket