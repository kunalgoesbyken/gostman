import { Suspense, useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EditorSkeleton } from "./ui/skeleton"
import { SCHEMA_TEXT } from "../lib/checksText"
import { schemaText } from "../lib/jsonSchema"

const PRETTY_INDENT = 2

export function SchemaDialog({ value, EditorComponent, onSave, onClose }) {
  const [text, setText] = useState(() => schemaText(value, PRETTY_INDENT))

  const save = () => {
    onSave(schemaText(text))
    onClose()
  }

  return (
    <Dialog label={SCHEMA_TEXT.editorTitle} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{SCHEMA_TEXT.editorTitle}</DialogTitle>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-2 overflow-hidden">
        <p className="shrink-0 text-xs text-muted-foreground">{SCHEMA_TEXT.editorHint}</p>
        <div className="min-h-0 flex-1 overflow-hidden rounded border border-border">
          <Suspense fallback={<EditorSkeleton />}>
            <EditorComponent value={text} onChange={(event) => setText(event.target.value)} language="json" height="100%" label={SCHEMA_TEXT.editorTitle} />
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
