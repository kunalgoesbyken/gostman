import { AlertTriangle, ArrowUpCircle, Download, Loader2, RotateCw, X } from "lucide-react"
import { STATUS_ITEM_CLASS, StatusItem } from "./StatusItem"
import { openExternal } from "../lib/about"
import {
  PHASE_DOWNLOADING, PHASE_FAILED, PHASE_READY, PHASE_VERIFYING,
  canInstall, confirmRestart, dismissUpdate, downloadUpdate, isBusy, openUpdatesSection, selectAvailableUpdate, useUpdateProgress, useUpdateStore,
} from "../lib/updates"
import { UPDATES_TEXT as TEXT } from "../lib/updatesText"
import { cn } from "../lib/utils"

export function DismissibleNotice({ icon, label, hint, dismissLabel, onOpen, onDismiss, className }) {
  return (
    <span className={cn("inline-flex h-full items-center text-primary", className)}>
      <StatusItem icon={icon} label={label} title={hint} onClick={onOpen} />
      <button type="button" aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss} className={cn(STATUS_ITEM_CLASS, "px-1 max-sm:px-2")}>
        <X aria-hidden="true" />
      </button>
    </span>
  )
}

const ratioOf = (progress) => (progress.total > 0 ? Math.min(progress.received / progress.total, 1) : 0)

function ProgressNotice({ progress, updates }) {
  if (progress.phase === PHASE_DOWNLOADING) {
    return (
      <DismissibleNotice
        icon={Download}
        label={TEXT.downloading(progress.version, ratioOf(progress))}
        hint={TEXT.downloadingDetail(progress.received, progress.total)}
        dismissLabel={TEXT.cancel}
        onOpen={openUpdatesSection}
        onDismiss={() => updates.cancel()}
        className="text-muted-foreground"
      />
    )
  }
  const label = progress.phase === PHASE_VERIFYING ? TEXT.verifying : TEXT.installing
  return <StatusItem icon={Loader2} label={label} onClick={openUpdatesSection} className="[&_svg]:animate-spin" />
}

function failedNotice(progress, updates) {
  return (
    <DismissibleNotice
      icon={AlertTriangle}
      label={TEXT.failed}
      hint={TEXT.failedHint}
      dismissLabel={TEXT.dismiss}
      onOpen={openUpdatesSection}
      onDismiss={() => {
        dismissUpdate(progress.version)
        updates.cancel()
      }}
      className="text-destructive"
    />
  )
}

const QUIET_WHEN_DISMISSED = [PHASE_READY, PHASE_FAILED]

export function useUpdateNotice() {
  const available = useUpdateStore(selectAvailableUpdate)
  const dismissed = useUpdateStore((state) => state.dismissed)
  const progress = useUpdateProgress()
  const isDismissed = progress.version !== "" && progress.version === dismissed
  if (isBusy(progress.phase)) return { progress, available }
  if (QUIET_WHEN_DISMISSED.includes(progress.phase) && !isDismissed) return { progress, available }
  return available ? { progress: null, available, installs: available.installs && canInstall(progress) } : null
}

export function UpdateNotice({ updates, notice }) {
  const { progress, available, installs } = notice

  if (progress?.phase === PHASE_READY) {
    return (
      <DismissibleNotice
        icon={RotateCw}
        label={TEXT.ready}
        hint={TEXT.readyHint(progress.version)}
        dismissLabel={TEXT.dismiss}
        onOpen={() => confirmRestart(updates)}
        onDismiss={() => dismissUpdate(progress.version)}
      />
    )
  }
  if (progress?.phase === PHASE_FAILED) return failedNotice(progress, updates)
  if (progress) return <ProgressNotice progress={progress} updates={updates} />

  return (
    <DismissibleNotice
      icon={ArrowUpCircle}
      label={installs ? TEXT.update : TEXT.available(available.version)}
      hint={installs ? TEXT.updateHint(available.version) : TEXT.downloadHint}
      dismissLabel={TEXT.dismiss}
      onOpen={(event) => (installs ? downloadUpdate(updates, available.version) : openExternal(event, available.download || available.url))}
      onDismiss={() => dismissUpdate(available.version)}
    />
  )
}
