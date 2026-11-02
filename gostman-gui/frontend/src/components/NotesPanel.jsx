import { useState } from "react"
import { Check, NotebookPen, RotateCcw, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Notice, Panel } from "./ui/panel"
import { Textarea } from "./ui/textarea"
import { looksLikeCredential } from "../lib/credentialLook"
import { formatDateTime } from "../lib/i18n/format"
import { NOTE_TEXT_LIMIT, parseNotes, serializeNotes, withNote, withResolved, withoutNote } from "../lib/notes"
import { NOTES_TEXT as TEXT } from "../lib/notesText"
import { usePreferences } from "../lib/preferences"
import { cn } from "../lib/utils"

const NOTE_DATE = { dateStyle: "medium", timeStyle: "short" }

const formatAt = (iso) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : formatDateTime(date, NOTE_DATE)
}

function NoteItem({ note, onResolve, onDelete }) {
  return (
    <li className={cn("space-y-1 border-b border-border px-3 py-2 text-xs", note.resolved && "opacity-70")}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{note.author || TEXT.anonymous}</span>
        <span className="text-muted-foreground">{formatAt(note.at)}</span>
        {note.resolved && <Badge variant="success">{TEXT.resolved}</Badge>}
        <span className="ms-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onResolve(note.id, !note.resolved)}>
            {note.resolved ? <RotateCcw /> : <Check />}
            {note.resolved ? TEXT.reopen : TEXT.resolve}
          </Button>
          <IconButton label={TEXT.delete} icon={Trash2} size="icon-xs" onClick={() => onDelete(note.id)} />
        </span>
      </div>
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{note.text}</p>
    </li>
  )
}

function NoteForm({ onAdd }) {
  const [text, setText] = useState("")
  const submit = (event) => {
    event.preventDefault()
    if (!text.trim()) return
    onAdd(text)
    setText("")
  }
  return (
    <form onSubmit={submit} className="space-y-2 border-b border-border p-3">
      <Textarea
        aria-label={TEXT.inputLabel}
        placeholder={TEXT.inputPlaceholder}
        rows={2}
        maxLength={NOTE_TEXT_LIMIT}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {looksLikeCredential("", text) && <Notice tone="warning">{TEXT.looksLikeCredential}</Notice>}
      <Button type="submit" size="sm" disabled={!text.trim()}>{TEXT.add}</Button>
    </form>
  )
}

export function NotesPanel({ notes, onChange }) {
  const { authorName } = usePreferences()
  const list = parseNotes(notes)
  const commit = (next) => onChange(serializeNotes(next))
  const add = (text) => commit(withNote(list, { text, author: authorName, at: new Date().toISOString() }))

  return (
    <Panel>
      <Notice>{TEXT.secretHint}</Notice>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NoteForm onAdd={add} />
        <ul aria-label={TEXT.listLabel}>
          {list.length === 0 && <EmptyState icon={NotebookPen} title={TEXT.empty} />}
          {list.map((note) => (
            <NoteItem key={note.id} note={note} onResolve={(id, resolved) => commit(withResolved(list, id, resolved))} onDelete={(id) => commit(withoutNote(list, id))} />
          ))}
        </ul>
      </div>
    </Panel>
  )
}
