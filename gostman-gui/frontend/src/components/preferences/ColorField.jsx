import { useEffect, useState } from "react"
import { Input } from "../ui/input"
import { parseHexInput } from "../../lib/color"
import { cn } from "../../lib/utils"

export function ColorField({ label, hexLabel, value, isCustom, onChange }) {
  const [draft, setDraft] = useState(value)
  const isValid = parseHexInput(draft) !== null

  useEffect(() => setDraft(value), [value])

  const changeHex = (event) => {
    setDraft(event.target.value)
    const color = parseHexInput(event.target.value)
    if (color && color !== value) onChange(color)
  }

  return (
    <span className="flex items-center gap-1.5">
      <input type="color" aria-label={label} title={label} value={value} onChange={(event) => onChange(event.target.value)} className="color-swatch" />
      <Input
        aria-label={hexLabel}
        dir="ltr"
        aria-invalid={!isValid}
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        onChange={changeHex}
        onBlur={() => setDraft(value)}
        className={cn("w-[4.5rem] font-mono", !isCustom && "text-muted-foreground")}
      />
    </span>
  )
}
