import { memo } from "react"
import { Cookie, GitBranch, Settings, Wifi, Newspaper } from "lucide-react"
import { cn } from "../lib/utils"
import { openGit, useGitStore } from "../lib/gitSession"
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
import { LiveTray } from "./LiveTray"
import { ToolTray } from "./ToolTray"

const gitLabel = (git) => (git.detached ? TEXT.detached : git.branch) + (git.changes.length > 0 ? ` (${git.changes.length})` : "")

export const StatusBar = memo(function StatusBar({ showsResizeGrip, tools, updates, remindsExport, onExport }) {
  const openCookies = useAppStore((s) => s.openCookiesDialog)
  const openSettings = useAppStore((s) => s.openSettingsDialog)
  const openPreferences = useAppStore((s) => s.openPreferencesDialog)
  const openAbout = useAppStore((s) => s.openAbout)
  const openWhatsNew = useAppStore((s) => s.openWhatsNew)
  const hasUnseenRelease = useAppStore((s) => releasesBetween(s.seenVersion, APP_VERSION).length > 0)
  const git = useGitStore((s) => s.state)

  return (
    <footer className="flex h-6 max-sm:h-10 shrink-0 items-center justify-between overflow-hidden border-t border-border bg-background px-1 text-2xs text-muted-foreground">
      <div className="flex h-full items-center">
        <StatusItem icon={Wifi} label={TEXT.network} onClick={openSettings} />
        {git.hasFolder && <StatusItem icon={GitBranch} label={git.isRepo ? gitLabel(git) : TEXT.git} onClick={openGit} />}
        <ToolTray actions={tools} />
        <LiveTray actions={tools} />
      </div>
      <div className="flex h-full items-center">
        {hasUnseenRelease && <StatusItem icon={Newspaper} label={FEATURES_TEXT.whatsNewTitle} title={FEATURES_TEXT.whatsNewDot(APP_VERSION)} className="text-primary" onClick={openWhatsNew} />}
        <DataNotices updates={updates} remindsExport={remindsExport} onExport={onExport} />
        <StatusItem icon={Cookie} label={TEXT.cookies} onClick={openCookies} />
        <StatusItem icon={Settings} label={PREFERENCES_TEXT.statusLabel} onClick={openPreferences} />
        <button type="button" title={ABOUT_TEXT.versionButton} onClick={openAbout} className={cn(STATUS_ITEM_CLASS, "font-mono text-3xs")}>v{__APP_VERSION__}<span className="sr-only"> {ABOUT_TEXT.versionButton}</span></button>
        {showsResizeGrip && <ResizeGrip />}
      </div>
    </footer>
  )
})
