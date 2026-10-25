import english from '../../../../locales/en/data.json'
import { formatBytes } from './byteSize'
import { messages } from './i18n/core'

const text = messages('data', english, (t) => {
  const usageParams = ({ usage, quota }) => ({ usage: formatBytes(usage), quota: formatBytes(quota) })
  const itemsOf = (group) => Object.keys(english.data[group]).map((name) => t(`data.${group}.${name}`))
  const withRoom = (key) => (room) => {
    if (!room) return t(key)
    return room.quota ? t(`${key}Usage`, usageParams(room)) : t(`${key}NoUsage`)
  }

  return {
    data: {
      backupVersion: (version) => (version ? t('data.backupVersion', { version }) : t('data.backupVersionUnknown')),
      restoreMessageDesktop: (date, version) => t('data.restoreMessageDesktop', { date, version }),
      restoreMessageBrowser: (date, version) => t('data.restoreMessageBrowser', { date, version }),
      browserStorageFull: withRoom('data.browserStorageFull'),
      tabsNotStored: withRoom('data.tabsNotStored'),
      damagedDataKept: (key, inDatabase) => t(inDatabase ? 'data.damagedDataKeptDatabase' : 'data.damagedDataKeptLocal', { key }),
      get deletedInBrowser() {
        return itemsOf('deletedInBrowser')
      },
      get deletedOnDesktop() {
        return itemsOf('deletedOnDesktop')
      },
      get keptInBrowser() {
        return itemsOf('keptInBrowser')
      },
      get keptOnDesktop() {
        return itemsOf('keptOnDesktop')
      },
    },
  }
})

export const DATA_TEXT = text.data
