import { Badge } from "./ui/badge"
import { statusText, statusVariantOf } from "../lib/callDisplay"
import { cn } from "../lib/utils"

export function CallStatus({ call, className, ...props }) {
  return <Badge variant={statusVariantOf(call)} className={cn("px-1 py-0", className)} {...props}>{statusText(call)}</Badge>
}
