import { Suspense, useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { toolWindow } from "../lib/dialogWindows"
import { EditorSkeleton } from "./ui/skeleton"
import { SCHEMA_TEXT } from "../lib/checksText"
import { schemaText } from "../lib/jsonSchema"

const SCHEMA_WINDOW = toolWindow("schema")

const PRETTY_INDENT = 2

export function SchemaDialog({ value, EditorComponent, onSave, onClose, text: wording = SCHEMA_TEXT }) {
  const [text, setText] = useState(() => schemaText(value, PRETTY_INDENT))

  const save = () => {
    onSave(schemaText(text))
    onClose()
  }

  return (
    <Dialog label={wording.editorTitle} size="lg" floating={SCHEMA_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{wording.editorTitle}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2 overflow-hidden">
        <p className="shrink-0 text-xs text-muted-foreground">{wording.editorHint}</p>
        {wording.notice && <p className="shrink-0 text-xs text-muted-foreground">{wording.notice}</p>}
        <div className="min-h-0 flex-1 overflow-hidden rounded border border-border">
          <Suspense fallback={<EditorSkeleton />}>
            <EditorComponent value={text} onChange={(event) => setText(event.target.value)} language="json" height="100%" label={wording.editorTitle} />
          </Suspense>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{SCHEMA_TEXT.cancel}</Button>
        <Button onClick={save}>{SCHEMA_TEXT.save}</Button>
      </DialogFooter>
    </Dialog>
  )
}
