import { ArrowUpCircle, Download, X } from "lucide-react"
import { STATUS_ITEM_CLASS, StatusItem } from "./StatusItem"
import { openExternal } from "../lib/about"
import { DATA_TEXT } from "../lib/dataText"
import { dismissExportReminder, useExportReminder } from "../lib/exportReminder"
import { PRIVACY_TEXT } from "../lib/privacyText"
import { dismissUpdate, selectAvailableUpdate, useUpdateCheck, useUpdateStore } from "../lib/updates"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

function DismissibleNotice({ icon, label, hint, dismissLabel, onOpen, onDismiss }) {
  return (
    <span className="inline-flex h-full items-center text-primary">
      <StatusItem icon={icon} label={label} title={hint} onClick={onOpen} />
      <button type="button" aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss} className={cn(STATUS_ITEM_CLASS, "px-1 max-sm:px-2")}>
        <X aria-hidden="true" />
      </button>
    </span>
  )
}

export function DataNotices({ updates, remindsExport, onExport }) {
  useUpdateCheck(updates)
  const update = useUpdateStore(selectAvailableUpdate)
  const requestCount = useAppStore((s) => s.requests.length)
  const remindsNow = useExportReminder(Boolean(remindsExport), requestCount)

  if (update) {
    return (
      <DismissibleNotice
        icon={ArrowUpCircle}
        label={PRIVACY_TEXT.updateAvailable(update.version)}
        hint={PRIVACY_TEXT.updateHint}
        dismissLabel={PRIVACY_TEXT.updateDismiss}
        onOpen={(event) => openExternal(event, update.url)}
        onDismiss={() => dismissUpdate(update.version)}
      />
    )
  }
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
