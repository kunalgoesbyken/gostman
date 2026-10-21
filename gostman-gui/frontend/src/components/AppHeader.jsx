import { ArrowLeft, Download, Import, RotateCcw, Search } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { EnvironmentSwitcher } from "./EnvironmentSwitcher"
import { StorageMenu } from "./StorageMenu"
import { WindowControls } from "./WindowControls"
import { isDesktopShell } from "../lib/windowControls"
import { promptInstall, useInstallable } from "../lib/pwa"
import { INSTALL_TEXT } from "../lib/installText"
import { useShortcutLabel } from "../hooks/useShortcuts"
import logo from "../assets/logo.jpg"

const DRAG = { "--wails-draggable": "drag" }
const NO_DRAG = { "--wails-draggable": "no-drag" }

export function AppHeader({ storage, onImport, onReset, onOpenCommands, onBack }) {
  const isDesktop = isDesktopShell()
  const paletteShortcut = useShortcutLabel("commandPalette")
  const canInstall = useInstallable()

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3" style={isDesktop ? DRAG : undefined}>
      {onBack && <IconButton label="Back to the landing page" icon={ArrowLeft} size="icon" onClick={onBack} />}

      {onBack || isDesktop ? (
        <div className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="" className="h-6 w-6 rounded" />
          <h1 className="font-brand text-sm font-semibold">Gostman</h1>
        </div>
      ) : (
        <h1 className="sr-only">Gostman</h1>
      )}

      <div style={isDesktop ? NO_DRAG : undefined}>
        <StorageMenu storage={storage} />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3" style={isDesktop ? NO_DRAG : undefined}>
        <Button variant="ghost" onClick={onOpenCommands} className="hidden lg:inline-flex">
          <Search />
          Commands
          {paletteShortcut && <kbd>{paletteShortcut}</kbd>}
        </Button>
        <EnvironmentSwitcher />
        {canInstall && (
          <Button variant="ghost" onClick={promptInstall} title={INSTALL_TEXT.description}>
            <Download />
            <span className="hidden sm:inline">{INSTALL_TEXT.label}</span>
          </Button>
        )}
        <Button variant="outline" onClick={onImport}>
          <Import />
          Import
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Reset app and delete all data" icon={RotateCcw} size="icon" onClick={onReset} />
        </div>
      </div>
      {isDesktop && <WindowControls />}
    </header>
  )
}
