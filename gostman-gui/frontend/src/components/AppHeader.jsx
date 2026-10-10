import { ArrowLeft, RotateCcw, Import } from "lucide-react"
import { Button } from "./ui/button"
import { EnvironmentSwitcher } from "./EnvironmentSwitcher"
import logo from "../assets/logo.jpg"

export function AppHeader({ onImport, onReset, onBack }) {
  return (
    <header className="flex items-center gap-4 border-b border-border/60 bg-muted/10 px-4 py-2.5">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to landing page"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}

      <div className="flex min-w-0 items-center gap-2.5">
        <img src={logo} alt="" className="h-7 w-7 rounded-md" />
        <div className="min-w-0 leading-tight">
          <h1 className="font-brand text-[15px] font-bold tracking-tight">Gostman</h1>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">HTTP Client</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <EnvironmentSwitcher />

        <div className="h-5 w-px bg-border" />

        <Button variant="outline" size="sm" onClick={onImport} className="h-8 gap-2">
          <Import className="h-4 w-4" />
          Import
        </Button>

        <div className="h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          aria-label="Reset and clear all local data"
          className="h-8 w-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
