import { useState } from "react"
import { Info } from "lucide-react"
import { IconButton } from "./button"

export function InfoTip({ text }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative" onBlur={() => setIsOpen(false)}>
      <IconButton label={text} icon={Info} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} />
      {isOpen && (
        <p role="tooltip" className="absolute bottom-full start-0 z-10 mb-1 w-64 max-w-[80vw] rounded-md border border-border bg-background p-2 text-xs shadow-lg">
          {text}
        </p>
      )}
    </div>
  )
}
