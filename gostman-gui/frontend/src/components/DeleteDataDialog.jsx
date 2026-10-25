import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { DATA_TEXT as TEXT } from "../lib/dataText"
import { searchCollator } from "../lib/i18n/format"
import { isDesktopShell } from "../lib/windowControls"
import { WORKSPACE_TEXT } from "../lib/workspaceText"
import { useAppStore } from "../store/appStore"

const isConfirmWord = (typed) => searchCollator().compare(typed.trim(), TEXT.confirmWord) === 0

function ItemList({ heading, items }) {
  return (
    <section aria-label={heading} className="space-y-1.5">
      <SectionLabel className="block">{heading}</SectionLabel>
      <ul className="list-disc space-y-1 ps-4 text-xs leading-relaxed">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

export function DeleteDataDialog({ onDelete, onExport, onClose }) {
  const [typed, setTyped] = useState("")
  const hasFolderOpen = useAppStore((s) => s.workspaceStatus.path !== "")
  const isDesktop = isDesktopShell()
  const deleted = isDesktop ? TEXT.deletedOnDesktop : TEXT.deletedInBrowser
  const kept = isDesktop ? TEXT.keptOnDesktop : TEXT.keptInBrowser
  const advice = hasFolderOpen ? TEXT.folderExportAdvice(WORKSPACE_TEXT.localLabel) : TEXT.exportAdvice
  const isConfirmed = isConfirmWord(typed)

  const submit = (event) => {
    event.preventDefault()
    if (isConfirmed) onDelete()
  }

  return (
    <Dialog label={TEXT.title} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <Notice role="note" tone="destructive" icon={AlertTriangle} edge="border" className="rounded-md border-destructive/40 font-medium leading-relaxed">{TEXT.backupsWarning}</Notice>
          <ItemList heading={TEXT.deletedHeading} items={deleted} />
          <ItemList heading={TEXT.keptHeading} items={kept} />
          <p className="text-xs leading-relaxed text-muted-foreground">{advice}</p>
          <label className="flex flex-col gap-2 text-xs text-muted-foreground">
            {TEXT.confirmPrompt(TEXT.confirmWord)}
            <Input
              autoFocus
              controlSize="md"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{TEXT.cancel}</Button>
          <Button onClick={onExport}>{TEXT.exportFirst}</Button>
          <Button type="submit" variant="destructive" disabled={!isConfirmed}>{TEXT.confirm}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
