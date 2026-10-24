import mark from "../../assets/mark.png"
import { cn } from "../../lib/utils"

const markMask = `url(${mark}) center / contain no-repeat`

export function Logo({ className }) {
  return (
    <span
      aria-hidden="true"
      style={{ mask: markMask, WebkitMask: markMask }}
      className={cn("inline-block shrink-0 bg-brand", className)}
    />
  )
}
