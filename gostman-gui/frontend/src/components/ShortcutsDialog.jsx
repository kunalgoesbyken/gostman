import { useMemo } from "react"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "./ui/dialog"
import { SHORTCUT_GROUPS, isDesktopApp, shortcutRows } from "../lib/shortcuts"

export function ShortcutsDialog({ onClose }) {
  const rows = useMemo(shortcutRows, [])
  const isDesktop = isDesktopApp()

  return (
    <Dialog label="Keyboard shortcuts" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4 overflow-y-auto">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} aria-label={group}>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
            <ul>
              {rows.filter((row) => row.group === group).map((row) => (
                <li key={row.id} className="flex h-8 items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <kbd>{row.keys}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!isDesktop && (
          <p className="text-[11px] text-muted-foreground">
            In the browser, Alt replaces the shortcuts that browsers keep for themselves: Ctrl+W, Ctrl+Shift+T and Ctrl+Tab.
          </p>
        )}
      </DialogBody>
    </Dialog>
  )
}
