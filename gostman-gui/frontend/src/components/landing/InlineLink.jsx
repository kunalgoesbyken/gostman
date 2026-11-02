import { cn } from "../../lib/utils"

export function InlineLink({ className, ...props }) {
  return <a className={cn("text-foreground underline underline-offset-4 hover:text-primary", className)} {...props} />
}
