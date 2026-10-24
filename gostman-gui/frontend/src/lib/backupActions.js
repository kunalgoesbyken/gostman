import { DATA_TEXT as TEXT } from './dataText'
import { isDesktopApp } from './platform'
import { getPreferences } from './preferences'
import { useAppStore } from '../store/appStore'

const store = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

export const backupDate = (backup) => new Intl.DateTimeFormat(getPreferences().language, { dateStyle: 'medium', timeStyle: 'short' }).format(backup.createdAt)

const restoreMessage = (backup) => {
  const message = isDesktopApp() ? TEXT.restoreMessageDesktop : TEXT.restoreMessageBrowser
  return message(backupDate(backup), TEXT.backupVersion(backup.version))
}

export function createBackupActions(backend) {
  const { backups } = backend
  if (!backups) return null

  const restore = async (backup) => {
    try {
      const restoring = backups.restore(backup.id)
      store().suspendPersistence()
      await restoring
      store().showNotice(TEXT.restored(backupDate(backup)))
    } catch (error) {
      store().showAlert(TEXT.restoreFailed, messageOf(error), 'OK', 'warning')
    }
  }

  const openFolder = async () => {
    try {
      await backups.openFolder()
    } catch (error) {
      store().showAlert(TEXT.openBackupsFailed, messageOf(error), 'OK', 'warning')
    }
  }

  return {
    list: backups.list,
    confirmRestore: (backup) => store().showConfirm(TEXT.restoreTitle, restoreMessage(backup), () => restore(backup), null, 'destructive', TEXT.restoreConfirm),
    openFolder: backups.openFolder ? openFolder : null,
    remindsExport: backups.remindsExport,
  }
}
