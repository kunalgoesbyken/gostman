import { Badge } from "./ui/badge"
import { statusText, statusVariantOf } from "../lib/callDisplay"

export function CallStatus({ call }) {
  return <Badge variant={statusVariantOf(call)} className="px-1 py-0">{statusText(call)}</Badge>
}
