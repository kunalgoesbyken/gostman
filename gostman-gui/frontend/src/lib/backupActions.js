import { DATA_TEXT as TEXT } from './dataText'
import { DIALOG_TEXT } from './dialogText'
import { formatDateTime } from './i18n/format'
import { isDesktopApp } from './platform'
import { useAppStore } from '../store/appStore'

const store = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

const BACKUP_DATE = { dateStyle: 'medium', timeStyle: 'short' }

export const backupDate = (backup) => formatDateTime(backup.createdAt, BACKUP_DATE)

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
      store().showAlert(TEXT.restoreFailed, messageOf(error), DIALOG_TEXT.ok, 'warning')
    }
  }

  const openFolder = async () => {
    try {
      await backups.openFolder()
    } catch (error) {
      store().showAlert(TEXT.openBackupsFailed, messageOf(error), DIALOG_TEXT.ok, 'warning')
    }
  }

  return {
    list: backups.list,
    confirmRestore: (backup) => store().showConfirm(TEXT.restoreTitle, restoreMessage(backup), () => restore(backup), null, 'destructive', TEXT.restoreConfirm),
    openFolder: backups.openFolder ? openFolder : null,
    remindsExport: backups.remindsExport,
  }
}
