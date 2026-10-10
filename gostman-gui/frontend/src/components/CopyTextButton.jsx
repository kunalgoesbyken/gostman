import { Check, Copy } from "lucide-react"
import { Button } from "./ui/button"
import { useClipboardCopy } from "../hooks/useClipboardCopy"

export function CopyTextButton({ text }) {
  const { copied, copy } = useClipboardCopy(text)

  return (
    <Button variant="outline" size="sm" disabled={!text} onClick={copy}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}
