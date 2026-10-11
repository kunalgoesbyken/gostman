import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { IconButton } from "./ui/button"
import { Input } from "./ui/input"

export function TextInput({ value, onChange, ...props }) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      autoComplete="off"
      className="font-mono"
      {...props}
    />
  )
}

export function SecretInput({ value, onChange }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative min-w-0">
      <TextInput type={revealed ? "text" : "password"} value={value} onChange={onChange} className="pr-8 font-mono" />
      <IconButton
        label={revealed ? "Hide value" : "Show value"}
        icon={revealed ? EyeOff : Eye}
        size="icon-xs"
        onClick={() => setRevealed(!revealed)}
        className="absolute right-0.5 top-0.5"
      />
    </div>
  )
}
