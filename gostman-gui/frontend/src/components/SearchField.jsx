import { Search } from "lucide-react"
import { Input } from "./ui/input"
import { Toolbar } from "./ui/panel"

export function SearchField({ value, onChange, placeholder, onKeyDown, className, children }) {
  return (
    <Toolbar className={className}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute inset-y-0 start-2 my-auto h-3.5 w-3.5 text-muted-foreground" />
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
      </div>
      {children}
    </Toolbar>
  )
}
