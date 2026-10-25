import { Button } from "./button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { DIALOG_TEXT } from "../../lib/dialogText"

const CONFIRM_VARIANTS = { destructive: "destructive", outline: "outline" }
const TEXT_CLASS = "whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"

function MessagePart({ part }) {
  if (typeof part === "string") return <p className={TEXT_CLASS}>{part}</p>
  return <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-2 font-mono text-xs text-foreground [overflow-wrap:anywhere]">{part.code}</pre>
}

function ConfirmMessage({ message }) {
  if (!Array.isArray(message)) return <p className={TEXT_CLASS}>{message}</p>
  return (
    <div className="flex flex-col gap-3">
      {message.map((part, index) => <MessagePart key={index} part={part} />)}
    </div>
  )
}

export function ConfirmDialog({ isOpen, title, message, confirmText, variant, onConfirm, onCancel, alternativeText, onAlternative }) {
  if (!isOpen) return null

  return (
    <Dialog label={title} onClose={onCancel}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <ConfirmMessage message={message} />
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" autoFocus onClick={onCancel}>{DIALOG_TEXT.cancel}</Button>
        <Button variant={CONFIRM_VARIANTS[variant] ?? "default"} onClick={onConfirm}>{confirmText}</Button>
        {alternativeText && <Button onClick={onAlternative}>{alternativeText}</Button>}
      </DialogFooter>
    </Dialog>
  )
}
