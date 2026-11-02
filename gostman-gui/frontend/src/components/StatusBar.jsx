import { Activity, Compass, Cookie, GitBranch, Radio, Server, Settings, SlidersHorizontal, Sparkles } from "lucide-react"
import { cn } from "../lib/utils"
import { useCaptureStore } from "../lib/captureSession"
import { openGit, useGitStore } from "../lib/gitSession"
import { useMockStore } from "../lib/mockServer"
import { useMonitorStore } from "../lib/monitors/monitorSession"
import { MONITORS_TEXT } from "../lib/monitorsText"
import { ABOUT_TEXT } from "../lib/aboutText"
import { APP_VERSION } from "../lib/appVersion"
import { FEATURES_TEXT } from "../lib/featuresText"
import { releasesBetween } from "../lib/releaseNotes"
import { PREFERENCES_TEXT } from "../lib/preferencesText"
import { STATUS_BAR_TEXT as TEXT } from "../lib/statusBarText"
import { useAppStore } from "../store/appStore"
import { DataNotices } from "./DataNotices"
import { STATUS_ITEM_CLASS, StatusItem } from "./StatusItem"

const gitLabel = (git) => (git.detached ? TEXT.detached : git.branch) + (git.changes.length > 0 ? ` (${git.changes.length})` : "")

const portOf = (address) => {
  try {
    return new URL(address).port
  } catch {
    return ""
  }
}

export function StatusBar({ onOpenMock, onOpenCapture, onOpenMonitors, updates, remindsExport, onExport }) {
  const openCookies = useAppStore((s) => s.openCookiesDialog)
  const openSettings = useAppStore((s) => s.openSettingsDialog)
  const openPreferences = useAppStore((s) => s.openPreferencesDialog)
  const openAbout = useAppStore((s) => s.openAbout)
  const openExplore = useAppStore((s) => s.openExplore)
  const openWhatsNew = useAppStore((s) => s.openWhatsNew)
  const hasUnseenRelease = useAppStore((s) => releasesBetween(s.seenVersion, APP_VERSION).length > 0)
  const isMockRunning = useMockStore((s) => s.isRunning)
  const mockPort = useMockStore((s) => portOf(s.address))
  const isCapturing = useCaptureStore((s) => s.isRunning)
  const git = useGitStore((s) => s.state)
  const activeMonitors = useMonitorStore((s) => s.monitors.filter((monitor) => !monitor.paused).length)

  return (
    <footer className="flex h-6 max-sm:h-10 shrink-0 items-center justify-between overflow-hidden border-t border-border bg-background px-1 text-2xs text-muted-foreground">
      <div className="flex h-full items-center">
        <StatusItem icon={Compass} label={FEATURES_TEXT.statusLabel} title={FEATURES_TEXT.statusTitle} onClick={() => openExplore()} />
        <StatusItem icon={Settings} label={TEXT.network} onClick={openSettings} />
        <StatusItem icon={Server} label={TEXT.mock(isMockRunning, mockPort)} active={isMockRunning} onClick={onOpenMock} />
        <StatusItem icon={Radio} label={TEXT.capture(isCapturing)} active={isCapturing} onClick={onOpenCapture} />
        <StatusItem icon={Activity} label={activeMonitors > 0 ? MONITORS_TEXT.statusLabelRunning(activeMonitors) : MONITORS_TEXT.statusLabel} active={activeMonitors > 0} onClick={onOpenMonitors} />
        {git.hasFolder && <StatusItem icon={GitBranch} label={git.isRepo ? gitLabel(git) : TEXT.git} onClick={openGit} />}
      </div>
      <div className="flex h-full items-center">
        {hasUnseenRelease && <StatusItem icon={Sparkles} label={FEATURES_TEXT.whatsNewTitle} title={FEATURES_TEXT.whatsNewDot(APP_VERSION)} className="text-primary" onClick={openWhatsNew} />}
        <DataNotices updates={updates} remindsExport={remindsExport} onExport={onExport} />
        <StatusItem icon={Cookie} label={TEXT.cookies} onClick={openCookies} />
        <StatusItem icon={SlidersHorizontal} label={PREFERENCES_TEXT.statusLabel} onClick={openPreferences} />
        <button type="button" title={ABOUT_TEXT.versionButton} aria-label={ABOUT_TEXT.versionButton} onClick={openAbout} className={cn(STATUS_ITEM_CLASS, "font-mono text-3xs")}>v{__APP_VERSION__}</button>
      </div>
    </footer>
  )
}
