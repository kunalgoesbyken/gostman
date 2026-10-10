import { useCallback, useState } from "react"

const COPIED_NOTICE_MS = 2000

export function useClipboardCopy(text) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
  }, [text])

  return { copied, copy }
}
