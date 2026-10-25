import * as React from "react"
import { cn } from "../../lib/utils"

export const CONTROL_SIZES = {
  sm: "h-7",
  md: "h-8",
}

export const CONTROL_BASE = "w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"

const Input = React.forwardRef(({ className, type = "text", controlSize = "sm", ...props }, ref) => (
  <input type={type} className={cn(CONTROL_BASE, CONTROL_SIZES[controlSize], className)} ref={ref} {...props} />
))
Input.displayName = "Input"

export { Input }
