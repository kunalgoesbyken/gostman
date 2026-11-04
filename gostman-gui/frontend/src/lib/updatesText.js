import english from '../../../../locales/en/updates.json'
import { formatBytes } from './byteSize'
import { formatDateTime, formatPercent } from './i18n/format'
import { messages } from './i18n/core'

const MANAGER_COMMANDS = {
  scoop: 'scoop update gostman',
  homebrew: 'brew upgrade --cask gostman',
}

const text = messages('updates', english, (t) => ({
  updates: {
    checkedAt: (at) => t('updates.checkedAt', { when: formatDateTime(at) }),
    downloading: (version, ratio) => t('updates.downloading', { version, percent: formatPercent(ratio, { maximumFractionDigits: 0 }) }),
    downloadingDetail: (received, total) => t('updates.downloadingDetail', { received: formatBytes(received), total: formatBytes(total) }),
    failure: (code) => (english.updates.failures[code] ? t(`updates.failures.${code}`) : t('updates.failures.install')),
    manualHint: (manager) => {
      if (MANAGER_COMMANDS[manager]) return t(`updates.manual.${manager}`, { command: MANAGER_COMMANDS[manager] })
      return english.updates.manual[manager] ? t(`updates.manual.${manager}`) : t('updates.manual.other')
    },
  },
}))

export const UPDATES_TEXT = text.updates
