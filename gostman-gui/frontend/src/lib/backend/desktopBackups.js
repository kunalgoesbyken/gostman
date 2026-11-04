import { CancelUpdate, DownloadUpdate, LatestRelease, ListBackups, OpenBackupsFolder, RestartToUpdate, RestoreBackup, SetAutoInstall, UpdateState } from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'

const UPDATE_STATE_EVENT = 'update:state'

export const createDesktopBackups = (gate) => ({
  list: () => ListBackups(),
  restore: (id) => gate.during(() => RestoreBackup(id)),
  openFolder: () => OpenBackupsFolder(),
  remindsExport: false,
})

export const desktopUpdates = {
  latest: () => LatestRelease(),
  state: () => UpdateState(),
  download: (version) => DownloadUpdate(version),
  cancel: () => CancelUpdate(),
  restart: () => RestartToUpdate(),
  setAutoInstall: (enabled) => SetAutoInstall(enabled),
  onState: (listener) => EventsOn(UPDATE_STATE_EVENT, listener),
}
