import { ArrowLeft, Download, Import, PanelLeft, RotateCcw, Search } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { EnvironmentSwitcher } from "./EnvironmentSwitcher"
import { StorageMenu } from "./StorageMenu"
import { WindowControls } from "./WindowControls"
import { isDesktopShell, isDragRegion, windowControls } from "../lib/windowControls"
import { promptInstall, useInstallable } from "../lib/pwa"
import { INSTALL_TEXT } from "../lib/installText"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { useWindowFrame } from "../hooks/useWindowFrame"
import { Logo } from "./ui/logo"

const DRAG = { "--wails-draggable": "drag" }
const NO_DRAG = { "--wails-draggable": "no-drag" }

const toggleMaximiseOnDragRegion = (event) => {
  if (isDragRegion(event.target)) windowControls.toggleMaximise()
}

export function AppHeader({ storage, windowFrame, onImport, onReset, onOpenCommands, onToggleSidebar, onBack, gettingStarted }) {
  const isDesktop = isDesktopShell()
  const drawsTitleBar = Boolean(useWindowFrame(windowFrame)?.frameless)
  const paletteShortcut = useShortcutLabel("commandPalette")
  const canInstall = useInstallable()

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3 max-sm:gap-2" style={drawsTitleBar ? DRAG : undefined} onDoubleClick={drawsTitleBar ? toggleMaximiseOnDragRegion : undefined}>
      <IconButton label="Toggle sidebar" icon={PanelLeft} size="icon" onClick={onToggleSidebar} className="md:hidden" />
      {onBack && <IconButton label="Back to the landing page" icon={ArrowLeft} size="icon" onClick={onBack} />}

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

      <div className="ml-auto flex min-w-0 items-center gap-3 max-sm:gap-2" style={drawsTitleBar ? NO_DRAG : undefined}>
        <Button variant="ghost" onClick={onOpenCommands} className="hidden lg:inline-flex">
          <Search />
          Commands
          {paletteShortcut && <kbd>{paletteShortcut}</kbd>}
        </Button>
        <IconButton label="Commands" icon={Search} size="icon" onClick={onOpenCommands} className="lg:hidden" />
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
          Import
        </Button>
        <IconButton label="Reset app and delete all data" icon={RotateCcw} size="icon" onClick={onReset} className="max-sm:hidden" />
      </div>
      {drawsTitleBar && <WindowControls />}
    </header>
  )
}
