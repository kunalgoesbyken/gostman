import { useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { Button } from "../ui/button"
import { PreferenceGroup } from "./PreferenceRows"
import { backupDate } from "../../lib/backupActions"
import { KIND_BEFORE_RESTORE } from "../../lib/backupKinds"
import { DATA_TEXT as TEXT } from "../../lib/dataText"
import { formatBytes } from "../../lib/byteSize"

const LOADING = "loading"
const FAILED = "failed"

function useBackupList(list) {
  const [backups, setBackups] = useState(LOADING)

  useEffect(() => {
    let isCurrent = true
    list()
      .then((found) => isCurrent && setBackups(found))
      .catch(() => isCurrent && setBackups(FAILED))
    return () => {
      isCurrent = false
    }
  }, [list])

  return backups
}

const detailsOf = (backup) => [
  TEXT.backupVersion(backup.version),
  formatBytes(backup.size),
  backup.kind === KIND_BEFORE_RESTORE && TEXT.beforeRestore,
].filter(Boolean).join(" · ")

function BackupRow({ backup, onRestore }) {
  const date = backupDate(backup)

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="min-w-0 text-xs">
        {date}
        <span className="block text-2xs text-muted-foreground">{detailsOf(backup)}</span>
      </span>
      <Button variant="outline" size="sm" aria-label={TEXT.restoreLabel(date)} onClick={() => onRestore(backup)}>
        {TEXT.restoreAction}
      </Button>
    </li>
  )
}

function statusOf(backups) {
  if (backups === LOADING) return TEXT.backupsLoading
  if (backups === FAILED) return TEXT.backupsUnavailable
  return backups.length === 0 ? TEXT.backupsEmpty : ""
}

export function BackupsGroup({ backups, hint, note }) {
  const listed = useBackupList(backups.list)
  const status = statusOf(listed)
  const openFolder = backups.openFolder && (
    <Button variant="outline" size="sm" onClick={backups.openFolder}>
      <FolderOpen />
      {TEXT.openBackupsFolder}
    </Button>
  )

  return (
    <PreferenceGroup title={TEXT.backupsLabel} hint={hint} action={openFolder}>
      {note && <p className="text-2xs text-muted-foreground">{note}</p>}
      {status ? (
        <p role="status" className="text-2xs text-muted-foreground">{status}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {listed.map((backup) => <BackupRow key={backup.id} backup={backup} onRestore={backups.confirmRestore} />)}
        </ul>
      )}
    </PreferenceGroup>
  )
}
