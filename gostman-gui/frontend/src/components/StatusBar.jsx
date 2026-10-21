import { Cookie, Radio, Server, Settings } from "lucide-react"
import { cn } from "../lib/utils"
import { useCaptureStore } from "../lib/captureSession"
import { useMockStore } from "../lib/mockServer"
import { useAppStore } from "../store/appStore"

const ITEM_CLASS = "inline-flex h-full items-center gap-1.5 px-2 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-3"

function StatusItem({ icon: Icon, label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cn(ITEM_CLASS, active && "text-success")}>
      <Icon aria-hidden="true" />
      {label}
    </button>
  )
}

export function StatusBar({ onOpenMock, onOpenCapture }) {
  const openCookies = useAppStore((s) => s.openCookiesDialog)
  const openSettings = useAppStore((s) => s.openSettingsDialog)
  const isMockRunning = useMockStore((s) => s.isRunning)
  const isCapturing = useCaptureStore((s) => s.isRunning)

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-background px-1 text-[11px] text-muted-foreground">
      <div className="flex h-full items-center">
        <StatusItem icon={Settings} label="Network" onClick={openSettings} />
        <StatusItem icon={Server} label={isMockRunning ? "Mock server (running)" : "Mock server"} active={isMockRunning} onClick={onOpenMock} />
        <StatusItem icon={Radio} label={isCapturing ? "Capture (running)" : "Capture"} active={isCapturing} onClick={onOpenCapture} />
      </div>
      <div className="flex h-full items-center">
        <StatusItem icon={Cookie} label="Cookies" onClick={openCookies} />
        <span className="px-2 font-mono text-[10px]">v{__APP_VERSION__}</span>
      </div>
    </footer>
  )
}
