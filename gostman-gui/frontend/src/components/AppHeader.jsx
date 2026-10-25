import { ArrowLeft, Download, Import, PanelLeft, Search } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { EnvironmentSwitcher } from "./EnvironmentSwitcher"
import { StorageMenu } from "./StorageMenu"
import { WindowControls } from "./WindowControls"
import { isDesktopShell, isDragRegion, windowControls } from "../lib/windowControls"
import { promptInstall, useInstallable } from "../lib/pwa"
import { INSTALL_TEXT } from "../lib/installText"
import { SIDEBAR_TEXT } from "../lib/sidebarText"
import { APP_TEXT } from "../lib/appText"
import { COMMAND_TEXT } from "../lib/commandText"
import { IMPORT_TEXT } from "../lib/importText"
import { hintWithShortcut } from "../lib/shortcuts"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { useWindowFrame } from "../hooks/useWindowFrame"
import { useAppStore } from "../store/appStore"
import { Logo } from "./ui/logo"

const DRAG = { "--wails-draggable": "drag" }
const NO_DRAG = { "--wails-draggable": "no-drag" }

const toggleMaximiseOnDragRegion = (event) => {
  if (isDragRegion(event.target)) windowControls.toggleMaximise()
}

export function AppHeader({ storage, windowFrame, onImport, onOpenCommands, onToggleSidebar, onBack, gettingStarted }) {
  const isDesktop = isDesktopShell()
  const drawsTitleBar = Boolean(useWindowFrame(windowFrame)?.frameless)
  const paletteShortcut = useShortcutLabel("commandPalette")
  const sidebarShortcut = useShortcutLabel("toggleSidebar")
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const canInstall = useInstallable()

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3 max-sm:gap-2" style={drawsTitleBar ? DRAG : undefined} onDoubleClick={drawsTitleBar ? toggleMaximiseOnDragRegion : undefined}>
      <IconButton label={hintWithShortcut(SIDEBAR_TEXT.toggle, sidebarShortcut)} icon={PanelLeft} mirrored size="icon" aria-expanded={isSidebarOpen} onClick={onToggleSidebar} style={drawsTitleBar ? NO_DRAG : undefined} />
      {onBack && <IconButton label={APP_TEXT.backToLanding} icon={ArrowLeft} mirrored size="icon" onClick={onBack} />}

      {onBack || isDesktop ? (
        <div className="flex shrink-0 items-center gap-2">
          <Logo className="h-6 w-6 max-sm:hidden" />
          <h1 className="font-brand text-sm font-semibold max-sm:sr-only">Gostman</h1>
        </div>
      ) : (
        <h1 className="sr-only">Gostman</h1>
      )}

      <div style={drawsTitleBar ? NO_DRAG : undefined}>
        <StorageMenu storage={storage} />
      </div>

      <div className="ms-auto flex min-w-0 items-center gap-3 max-sm:gap-2" style={drawsTitleBar ? NO_DRAG : undefined}>
        <Button variant="ghost" onClick={onOpenCommands} className="hidden lg:inline-flex">
          <Search />
          {COMMAND_TEXT.heading}
          {paletteShortcut && <kbd>{paletteShortcut}</kbd>}
        </Button>
        <IconButton label={COMMAND_TEXT.heading} icon={Search} size="icon" onClick={onOpenCommands} className="lg:hidden" />
        {gettingStarted}
        <EnvironmentSwitcher />
        {canInstall && (
          <Button variant="ghost" onClick={promptInstall} title={INSTALL_TEXT.description}>
            <Download />
            <span className="hidden sm:inline">{INSTALL_TEXT.label}</span>
          </Button>
        )}
        <Button variant="outline" onClick={onImport} className="max-sm:hidden">
          <Import />
          {IMPORT_TEXT.importButton}
        </Button>
      </div>
      {drawsTitleBar && <WindowControls />}
    </header>
  )
}
