import { Search } from "lucide-react"
import { Input } from "./ui/input"
import { Toolbar } from "./ui/panel"
import { cn } from "../lib/utils"

export function SearchField({ value, onChange, placeholder, onKeyDown, className, children }) {
  return (
    <Toolbar className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        className="ps-7"
      />
      {children}
    </Toolbar>
  )
}
