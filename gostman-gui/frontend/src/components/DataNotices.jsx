import { Download } from "lucide-react"
import { DismissibleNotice, UpdateNotice, useUpdateNotice } from "./UpdateNotice"
import { DATA_TEXT } from "../lib/dataText"
import { dismissExportReminder, useExportReminder } from "../lib/exportReminder"
import { useUpdateCheck } from "../lib/updates"
import { useAppStore } from "../store/appStore"

export function DataNotices({ updates, remindsExport, onExport }) {
  useUpdateCheck(updates)
  const notice = useUpdateNotice()
  const requestCount = useAppStore((s) => s.requests.length)
  const remindsNow = useExportReminder(Boolean(remindsExport), requestCount)

  if (notice) return <UpdateNotice updates={updates} notice={notice} />
  if (!remindsNow) return null
  return (
    <DismissibleNotice
      icon={Download}
      label={DATA_TEXT.exportReminder}
      hint={DATA_TEXT.exportReminderHint}
      dismissLabel={DATA_TEXT.exportReminderDismiss}
      onOpen={onExport}
      onDismiss={dismissExportReminder}
    />
  )
}
