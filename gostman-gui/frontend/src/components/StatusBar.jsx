import { Cookie, GitBranch, Radio, Server, Settings, SlidersHorizontal } from "lucide-react"
import { cn } from "../lib/utils"
import { useCaptureStore } from "../lib/captureSession"
import { openGit, useGitStore } from "../lib/gitSession"
import { useMockStore } from "../lib/mockServer"
import { ABOUT_TEXT } from "../lib/aboutText"
import { PREFERENCES_TEXT } from "../lib/preferencesText"
import { STATUS_BAR_TEXT as TEXT } from "../lib/statusBarText"
import { useAppStore } from "../store/appStore"
import { DataNotices } from "./DataNotices"
import { STATUS_ITEM_CLASS, StatusItem } from "./StatusItem"

const gitLabel = (git) => (git.detached ? TEXT.detached : git.branch) + (git.changes.length > 0 ? ` (${git.changes.length})` : "")

export function StatusBar({ onOpenMock, onOpenCapture, updates, remindsExport, onExport }) {
  const openCookies = useAppStore((s) => s.openCookiesDialog)
  const openSettings = useAppStore((s) => s.openSettingsDialog)
  const openPreferences = useAppStore((s) => s.openPreferencesDialog)
  const openAbout = useAppStore((s) => s.openAbout)
  const isMockRunning = useMockStore((s) => s.isRunning)
  const isCapturing = useCaptureStore((s) => s.isRunning)
  const git = useGitStore((s) => s.state)

  return (
    <footer className="flex h-6 max-sm:h-10 shrink-0 items-center justify-between overflow-hidden border-t border-border bg-background px-1 text-2xs text-muted-foreground">
      <div className="flex h-full items-center">
        <StatusItem icon={Settings} label={TEXT.network} onClick={openSettings} />
        <StatusItem icon={Server} label={TEXT.mock(isMockRunning)} active={isMockRunning} onClick={onOpenMock} />
        <StatusItem icon={Radio} label={TEXT.capture(isCapturing)} active={isCapturing} onClick={onOpenCapture} />
        {git.hasFolder && <StatusItem icon={GitBranch} label={git.isRepo ? gitLabel(git) : TEXT.git} onClick={openGit} />}
      </div>
      <div className="flex h-full items-center">
        <DataNotices updates={updates} remindsExport={remindsExport} onExport={onExport} />
        <StatusItem icon={Cookie} label={TEXT.cookies} onClick={openCookies} />
        <StatusItem icon={SlidersHorizontal} label={PREFERENCES_TEXT.statusLabel} onClick={openPreferences} />
        <button type="button" title={ABOUT_TEXT.versionButton} aria-label={ABOUT_TEXT.versionButton} onClick={openAbout} className={cn(STATUS_ITEM_CLASS, "font-mono text-3xs")}>v{__APP_VERSION__}</button>
      </div>
    </footer>
  )
}
