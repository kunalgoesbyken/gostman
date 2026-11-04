import { AlertTriangle, ArrowUpCircle, CheckCircle2, RotateCw } from "lucide-react"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { PreferenceRow } from "./PreferenceRows"
import { RELEASES_URL, openExternal } from "../../lib/about"
import {
  PHASE_DOWNLOADING, PHASE_FAILED, PHASE_READY, PHASE_VERIFYING,
  canInstall, checkNow, confirmRestart, downloadUpdate, restartMessage, setAutoInstall, setUpdateChecks, useUpdateProgress, useUpdateStore,
} from "../../lib/updates"
import { UPDATES_TEXT as TEXT } from "../../lib/updatesText"
import { cn } from "../../lib/utils"

function checkStatus(state) {
  if (state.checkedFor !== __APP_VERSION__ || !state.checkedAt) return TEXT.neverChecked
  const outcome = state.failed ? TEXT.checkFailed : state.latest ? "" : TEXT.upToDate
  return [TEXT.checkedAt(state.checkedAt), outcome].filter(Boolean).join(" ")
}

function VersionRow({ updates }) {
  const status = useUpdateStore(checkStatus)
  const checking = useUpdateProgress((state) => state.checking)

  return (
    <PreferenceRow label={TEXT.installedLabel} hint={<span role="status">{checking ? TEXT.checking : status}</span>}>
      <span className="flex items-center gap-3">
        <span className="font-mono text-xs">v{__APP_VERSION__}</span>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => checkNow(updates)}>
          <RotateCw className={cn(checking && "animate-spin")} />
          {TEXT.checkNow}
        </Button>
      </span>
    </PreferenceRow>
  )
}

function ProgressBar({ received, total }) {
  const ratio = total > 0 ? Math.min(received / total, 1) : 0
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={TEXT.downloadingDetail(received, total)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

function releaseLink(release, label) {
  const address = release?.download || release?.url || RELEASES_URL
  return (
    <a href={address} target="_blank" rel="noreferrer" onClick={(event) => openExternal(event, address)} className="text-xs text-primary hover:underline">
      {label}
    </a>
  )
}

function availableDetail(latest, progress) {
  if (!canInstall(progress)) return TEXT.manualHint(progress.manager)
  return latest.installs ? TEXT.availableDetail : TEXT.availableUnverified
}

function cardContent(progress, latest, updates) {
  const version = progress.version || latest?.version
  if (progress.phase === PHASE_DOWNLOADING || progress.phase === PHASE_VERIFYING) {
    const isVerifying = progress.phase === PHASE_VERIFYING
    return {
      title: isVerifying ? TEXT.verifying : TEXT.downloading(version, progress.total > 0 ? progress.received / progress.total : 0),
      detail: progress.total > 0 && !isVerifying ? TEXT.downloadingDetail(progress.received, progress.total) : "",
      body: <ProgressBar received={isVerifying ? 1 : progress.received} total={isVerifying ? 1 : progress.total} />,
      action: !isVerifying && <Button variant="outline" size="sm" onClick={() => updates.cancel()}>{TEXT.cancel}</Button>,
    }
  }
  if (progress.phase === PHASE_READY) {
    return {
      icon: CheckCircle2,
      title: TEXT.readyDetail(version),
      detail: restartMessage(progress),
      action: <Button size="sm" onClick={() => confirmRestart(updates)}><RotateCw />{TEXT.restartNow}</Button>,
    }
  }
  if (progress.phase === PHASE_FAILED) {
    return {
      icon: AlertTriangle,
      tone: "text-destructive",
      title: TEXT.failed,
      detail: TEXT.failure(progress.failure),
      link: releaseLink(latest, TEXT.openRelease),
      action: <Button variant="outline" size="sm" onClick={() => downloadUpdate(updates, version)}>{TEXT.tryAgain}</Button>,
    }
  }
  if (!latest) return null
  const installs = latest.installs && canInstall(progress)
  return {
    icon: ArrowUpCircle,
    title: TEXT.available(latest.version),
    detail: availableDetail(latest, progress),
    link: releaseLink(latest, installs ? TEXT.releaseNotes : TEXT.download),
    action: installs && <Button size="sm" onClick={() => downloadUpdate(updates, latest.version)}>{TEXT.update}</Button>,
  }
}

function UpdateCard({ updates }) {
  const progress = useUpdateProgress()
  const latest = useUpdateStore((state) => (state.checkedFor === __APP_VERSION__ ? state.latest : null))
  const content = cardContent(progress, latest, updates)
  if (!content) return null
  const Icon = content.icon

  return (
    <section aria-live="polite" className="space-y-2.5 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", content.tone)}>
            {Icon && <Icon aria-hidden="true" className={cn("size-3.5", !content.tone && "text-primary")} />}
            {content.title}
          </p>
          {content.detail && <p className="mt-0.5 text-2xs text-muted-foreground">{content.detail}</p>}
        </div>
        <span className="flex items-center gap-3">
          {content.link}
          {content.action}
        </span>
      </div>
      {content.body}
    </section>
  )
}

function AutoInstallRow() {
  const autoInstall = useUpdateStore((state) => state.autoInstall)
  const progress = useUpdateProgress()
  const installs = canInstall(progress)
  const hint = !installs ? TEXT.manualHint(progress.manager) : progress.asksPermission ? TEXT.autoHintInstaller : TEXT.autoHint

  return (
    <PreferenceRow label={TEXT.autoLabel} hint={hint}>
      <Switch checked={autoInstall && installs} disabled={!installs} label={TEXT.autoLabel} onCheckedChange={setAutoInstall} />
    </PreferenceRow>
  )
}

export function UpdatesSection({ updates }) {
  const enabled = useUpdateStore((state) => state.enabled)

  return (
    <>
      <VersionRow updates={updates} />
      <UpdateCard updates={updates} />
      <PreferenceRow label={TEXT.checksLabel} hint={TEXT.checksHint}>
        <Switch checked={enabled} label={TEXT.checksLabel} onCheckedChange={setUpdateChecks} />
      </PreferenceRow>
      <AutoInstallRow />
    </>
  )
}
