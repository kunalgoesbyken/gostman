import * as React from "react"
import { cn } from "../../lib/utils"
import { CONTROL_BASE } from "./input"

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(CONTROL_BASE, "block resize-none py-1.5 font-mono leading-relaxed", className)}
    ref={ref}
    spellCheck={false}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
