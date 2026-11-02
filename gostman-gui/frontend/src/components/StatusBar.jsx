import { Activity, Cookie, GitBranch, Radio, Server, Settings, SlidersHorizontal, Newspaper } from "lucide-react"
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
import { ResizeGrip } from "./WindowResize"
import { STATUS_ITEM_CLASS, StatusItem } from "./StatusItem"

const gitLabel = (git) => (git.detached ? TEXT.detached : git.branch) + (git.changes.length > 0 ? ` (${git.changes.length})` : "")

const portOf = (address) => {
  try {
    return new URL(address).port
  } catch {
    return ""
  }
}

export function StatusBar({ isResizable, onOpenMock, onOpenCapture, onOpenMonitors, updates, remindsExport, onExport }) {
  const openCookies = useAppStore((s) => s.openCookiesDialog)
  const openSettings = useAppStore((s) => s.openSettingsDialog)
  const openPreferences = useAppStore((s) => s.openPreferencesDialog)
  const openAbout = useAppStore((s) => s.openAbout)
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
        <StatusItem icon={Settings} label={TEXT.network} onClick={openSettings} />
        {isMockRunning && <StatusItem icon={Server} label={TEXT.mock(true, mockPort)} active onClick={onOpenMock} />}
        {isCapturing && <StatusItem icon={Radio} label={TEXT.capture(true)} active onClick={onOpenCapture} />}
        {activeMonitors > 0 && <StatusItem icon={Activity} label={MONITORS_TEXT.statusLabelRunning(activeMonitors)} active onClick={onOpenMonitors} />}
        {git.hasFolder && <StatusItem icon={GitBranch} label={git.isRepo ? gitLabel(git) : TEXT.git} onClick={openGit} />}
      </div>
      <div className="flex h-full items-center">
        {hasUnseenRelease && <StatusItem icon={Newspaper} label={FEATURES_TEXT.whatsNewTitle} title={FEATURES_TEXT.whatsNewDot(APP_VERSION)} className="text-primary" onClick={openWhatsNew} />}
        <DataNotices updates={updates} remindsExport={remindsExport} onExport={onExport} />
        <StatusItem icon={Cookie} label={TEXT.cookies} onClick={openCookies} />
        <StatusItem icon={SlidersHorizontal} label={PREFERENCES_TEXT.statusLabel} onClick={openPreferences} />
        <button type="button" title={ABOUT_TEXT.versionButton} onClick={openAbout} className={cn(STATUS_ITEM_CLASS, "font-mono text-3xs")}>v{__APP_VERSION__}<span className="sr-only"> {ABOUT_TEXT.versionButton}</span></button>
        {isResizable && <ResizeGrip />}
      </div>
    </footer>
  )
}
