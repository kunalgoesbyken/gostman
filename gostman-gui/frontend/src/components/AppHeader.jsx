import { ArrowLeft, RotateCcw, Import } from "lucide-react"
import { Button } from "./ui/button"
import logo from "../assets/logo.jpg"

export function AppHeader({ className, onImport, onReset, onBack }) {
  return (
    <header className={`flex items-center gap-6 bg-muted/10 backdrop-blur-md px-6 ${className}`}>
      <div className="flex items-center gap-3">
        <img src={logo} alt="Gostman Logo" className="h-9 w-9 rounded-lg" />
        <div>
          <h1 className="text-base font-brand font-bold tracking-tight">Gostman</h1>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">HTTP Client</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
          <Import className="h-4 w-4" />
          Import
        </Button>
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Back to landing page"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
          title="Reset to default (Clear data)"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
