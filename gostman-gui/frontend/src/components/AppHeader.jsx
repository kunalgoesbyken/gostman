import { ArrowLeft, Cookie, Import, RotateCcw, Search, Server, Settings } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { EnvironmentSwitcher } from "./EnvironmentSwitcher"
import { useMockStore } from "../lib/mockServer"
import { shortcutLabel } from "../lib/platform"
import logo from "../assets/logo.jpg"

export function AppHeader({ onImport, onReset, onOpenCommands, onOpenCookies, onOpenSettings, onOpenMock, onBack }) {
  const isMockRunning = useMockStore((state) => state.isRunning)

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
      {onBack && <IconButton label="Back to the landing page" icon={ArrowLeft} size="icon" onClick={onBack} />}

      <div className="flex shrink-0 items-center gap-2">
        <img src={logo} alt="" className="h-6 w-6 rounded" />
        <h1 className="font-brand text-sm font-semibold">Gostman</h1>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-3">
        <Button variant="ghost" onClick={onOpenCommands} className="hidden lg:inline-flex">
          <Search />
          Commands
          <kbd>{shortcutLabel("K")}</kbd>
        </Button>
        <EnvironmentSwitcher />
        <Button variant="outline" onClick={onImport}>
          <Import />
          Import
        </Button>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={isMockRunning ? "Mock server (running)" : "Mock server"}
            icon={Server}
            size="icon"
            onClick={onOpenMock}
            className={isMockRunning ? "text-success" : undefined}
          />
          <IconButton label="Cookies" icon={Cookie} size="icon" onClick={onOpenCookies} />
          <IconButton label="Network settings" icon={Settings} size="icon" onClick={onOpenSettings} />
          <IconButton label="Reset app and delete all data" icon={RotateCcw} size="icon" onClick={onReset} />
        </div>
      </div>
    </header>
  )
}
