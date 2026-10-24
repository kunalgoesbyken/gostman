import { Download, Trash2 } from "lucide-react"
import { Button } from "../ui/button"
import { BackupsGroup } from "./BackupsGroup"
import { PreferenceRow } from "./PreferenceRows"
import { DATA_TEXT as TEXT } from "../../lib/dataText"
import { isDesktopShell } from "../../lib/windowControls"
import { useAppStore } from "../../store/appStore"

function locationOf(folderPath) {
  if (!isDesktopShell()) return TEXT.browserLocation
  return folderPath ? TEXT.folderLocation(folderPath) : TEXT.appDataLocation
}

export function DataSection({ onCommand, backups }) {
  const folderPath = useAppStore((s) => s.workspaceStatus.path)

  return (
    <>
      <PreferenceRow label={TEXT.location} hint={locationOf(folderPath)} />
      {backups && (
        <BackupsGroup
          backups={backups}
          hint={isDesktopShell() ? TEXT.backupsHintDesktop : TEXT.backupsHintBrowser}
          note={folderPath ? TEXT.folderBackupsNote : ""}
        />
      )}
      <PreferenceRow label={TEXT.exportLabel} hint={TEXT.exportHint}>
        <Button variant="outline" onClick={() => onCommand("export")}>
          <Download />
          {TEXT.exportAction}
        </Button>
      </PreferenceRow>
      <PreferenceRow label={TEXT.deleteLabel} hint={TEXT.deleteHint}>
        <Button variant="destructive" onClick={() => onCommand("reset")}>
          <Trash2 />
          {TEXT.deleteAction}
        </Button>
      </PreferenceRow>
    </>
  )
}
