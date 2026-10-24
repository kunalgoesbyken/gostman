import { LatestRelease, ListBackups, OpenBackupsFolder, RestoreBackup } from '../../../wailsjs/go/main/App'

export const createDesktopBackups = (gate) => ({
  list: () => ListBackups(),
  restore: (id) => gate.during(() => RestoreBackup(id)),
  openFolder: () => OpenBackupsFolder(),
  remindsExport: false,
})

export const desktopUpdates = {
  latest: () => LatestRelease(),
}
