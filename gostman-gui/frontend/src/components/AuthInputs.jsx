import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { IconButton } from "./ui/button"
import { VariableInput } from "./VariableInput"
import { AUTH_TEXT } from "../lib/authText"
import { holdsOnlyReferences } from "../lib/variables"

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

export function SecretInput({ value = "", onChange }) {
  const [revealed, setRevealed] = useState(false)
  const hasSecret = !holdsOnlyReferences(value)

  return (
    <div dir="ltr" className="relative min-w-0">
      <TextInput value={value} onChange={onChange} masked={hasSecret && !revealed} className="pe-8 font-mono" />
      {hasSecret && (
        <IconButton
          label={revealed ? AUTH_TEXT.hideValue : AUTH_TEXT.showValue}
          icon={revealed ? EyeOff : Eye}
          size="icon-xs"
          onClick={() => setRevealed(!revealed)}
          className="absolute end-0.5 top-0.5"
        />
      )}
    </div>
  )
}
