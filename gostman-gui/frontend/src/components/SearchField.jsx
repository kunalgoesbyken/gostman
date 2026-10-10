import { Search } from "lucide-react"
import { Input } from "./ui/input"

export function SearchField({ value, onChange, placeholder }) {
  return (
    <div className="relative border-b border-border/60 px-2 py-2">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        className="h-7 pl-7 text-xs"
      />
    </div>
  )
}
