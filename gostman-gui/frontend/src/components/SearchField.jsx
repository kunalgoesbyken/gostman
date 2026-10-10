import { Search } from "lucide-react"
import { Input } from "./ui/input"
import { Toolbar } from "./ui/panel"

export function SearchField({ value, onChange, placeholder }) {
  return (
    <Toolbar className="relative">
      <Search className="pointer-events-none absolute left-5 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        className="pl-7"
      />
    </Toolbar>
  )
}
