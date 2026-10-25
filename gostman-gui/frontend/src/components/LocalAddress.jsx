import { Check, Copy } from "lucide-react"
import { IconButton } from "./ui/button"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { RESPONSE_TEXT } from "../lib/responseText"

export function LocalAddress({ address }) {
  const { copied, copy } = useClipboardCopy(address)
  return (
    <div className="ml-auto flex min-w-0 items-center gap-1">
      <span title={address} className="min-w-0 truncate font-mono text-xs text-foreground">{address}</span>
      <IconButton label={copied ? RESPONSE_TEXT.copied : RESPONSE_TEXT.copyBaseUrl} icon={copied ? Check : Copy} onClick={copy} />
    </div>
  )
}
