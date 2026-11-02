import { useCallback, useState } from "react"

const COPIED_NOTICE_MS = 2000

function copyWithSelection(text) {
  const field = document.createElement("textarea")
  field.value = text
  field.setAttribute("readonly", "")
  field.style.position = "fixed"
  field.style.opacity = "0"
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    field.remove()
  }
}

export function useClipboardCopy(text) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      if (!copyWithSelection(text)) return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
  }, [text])

  return { copied, copy }
}
