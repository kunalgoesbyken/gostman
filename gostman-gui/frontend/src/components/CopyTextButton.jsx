import { Check, Copy } from "lucide-react"
import { Button } from "./ui/button"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { DIALOG_TEXT } from "../lib/dialogText"

export function CopyTextButton({ text }) {
  const { copied, copy } = useClipboardCopy(text)

  return (
    <Button variant="outline" size="sm" disabled={!text} onClick={copy}>
      {copied ? <Check /> : <Copy />}
      {copied ? DIALOG_TEXT.copied : DIALOG_TEXT.copy}
    </Button>
  )
}
