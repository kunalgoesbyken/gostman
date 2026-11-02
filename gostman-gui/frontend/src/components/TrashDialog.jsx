import { Folder, Globe, Send, Trash2, Undo2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { toolWindow } from "../lib/dialogWindows"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Notice } from "./ui/panel"
import { formatDateTime } from "../lib/i18n/format"
import { KIND_ENVIRONMENT, KIND_FOLDER, KIND_REQUEST, TRASH_DAYS, daysLeft } from "../lib/trash"
import { TRASH_TEXT as TEXT } from "../lib/trashText"
import { useTrashStore } from "../lib/trashSession"

const TRASH_WINDOW = toolWindow("trash", "compact")
const DELETED_AT = { dateStyle: "medium", timeStyle: "short" }
const KIND_ICONS = { [KIND_REQUEST]: Send, [KIND_FOLDER]: Folder, [KIND_ENVIRONMENT]: Globe }

function TrashRow({ entry, now, onRestore, onPurge }) {
  const Icon = KIND_ICONS[entry.kind]
  return (
    <li className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{entry.name || TEXT.unnamed}</span>
        <span className="block truncate text-muted-foreground">{formatDateTime(new Date(entry.deletedAt), DELETED_AT)} · {TEXT.daysLeft(daysLeft(entry, now))}</span>
      </span>
      <Badge variant="outline">{TEXT.kinds[entry.kind]}</Badge>
      <Button size="sm" variant="outline" onClick={() => onRestore(entry.id)}>
        <Undo2 />
        {TEXT.restore}
      </Button>
      <IconButton label={TEXT.deleteForever} icon={Trash2} size="icon-xs" onClick={() => onPurge(entry.id)} />
    </li>
  )
}

export function TrashDialog({ actions }) {
  const entries = useTrashStore((state) => state.entries)
  const now = Date.now()

  return (
    <Dialog label={TEXT.title} size="lg" floating={TRASH_WINDOW} onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{TEXT.title}</DialogTitle>
        <Button size="sm" variant="outline" className="ms-auto" disabled={entries.length === 0} onClick={actions.empty}>{TEXT.emptyBin}</Button>
      </DialogHeader>
      <Notice>{TEXT.note(TRASH_DAYS)}</Notice>
      <ul aria-label={TEXT.listLabel} className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 && <EmptyState icon={Trash2} title={TEXT.empty} />}
        {[...entries].reverse().map((entry) => (
          <TrashRow key={entry.id} entry={entry} now={now} onRestore={actions.restore} onPurge={actions.purge} />
        ))}
      </ul>
    </Dialog>
  )
}
