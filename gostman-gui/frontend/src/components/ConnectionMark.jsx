import { KeyRound } from "lucide-react"
import { BrandIcon } from "./ui/brandIcon"
import { ColorDot } from "./ui/colorPicker"
import { cn } from "../lib/utils"

export function ConnectionMark({ kind, color, className }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <ColorDot color={color} />
      <BrandIcon brand={kind} fallback={KeyRound} />
    </span>
  )
}
