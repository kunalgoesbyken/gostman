import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { IconButton } from "./ui/button"
import { Input } from "./ui/input"
import { VariableInput } from "./VariableInput"

const FIELD_PROPS = { spellCheck: false, autoComplete: "off" }

export function TextInput({ value, onChange, ...props }) {
  return (
    <VariableInput
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="font-mono"
      {...FIELD_PROPS}
      {...props}
    />
  )
}

export function SecretInput({ value, onChange }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative min-w-0">
      <Input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-8 font-mono"
        {...FIELD_PROPS}
      />
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
