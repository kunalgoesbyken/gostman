import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { CONTROL_BASE, CONTROL_SIZES } from "./input"

const Select = React.forwardRef(({ className, children, controlSize = "sm", ...props }, ref) => (
  <div className="relative min-w-0">
    <select
      className={cn(CONTROL_BASE, CONTROL_SIZES[controlSize], "appearance-none truncate pr-7", className)}
      ref={ref}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
  </div>
))
Select.displayName = "Select"

export { Select }
