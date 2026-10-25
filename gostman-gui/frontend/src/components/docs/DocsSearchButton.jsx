import { useBrowserOs } from "../../hooks/useBrowserOs"
import { Search } from "../landing/icons"
import { DOCS_TEXT } from "../../lib/docsText"

export function useShortcutLabel() {
  const os = useBrowserOs()
  if (!os) return ""
  return os === "macos" ? DOCS_TEXT.search.shortcut.macos : DOCS_TEXT.search.shortcut.other
}

export function DocsSearchButton({ onOpen }) {
  const shortcut = useShortcutLabel()

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground"
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate">{DOCS_TEXT.search.open}</span>
      {shortcut ? <kbd className="ml-auto max-lg:hidden">{shortcut}</kbd> : null}
    </button>
  )
}
