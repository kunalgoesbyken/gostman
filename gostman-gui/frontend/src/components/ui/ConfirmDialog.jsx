import { Button } from "./button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

export function ConfirmDialog({ isOpen, title, message, confirmText, variant, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <Dialog label={title} onClose={onCancel}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" autoFocus onClick={onCancel}>Cancel</Button>
        <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={onConfirm}>{confirmText}</Button>
      </DialogFooter>
    </Dialog>
  )
}
