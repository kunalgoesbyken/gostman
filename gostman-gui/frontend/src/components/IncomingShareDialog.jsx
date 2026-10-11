import { Dialog, DialogBody, DialogHeader, DialogTitle } from "./ui/dialog"
import { ShareOpener } from "./ShareOpener"

export function IncomingShareDialog({ reference, onImport, onClose }) {
  return (
    <Dialog label="Shared collection" className="max-w-xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>Shared with you</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="pb-3 text-xs text-muted-foreground">
          This link carries an encrypted collection. It is decrypted in this window and nothing is added until you choose Import.
        </p>
        <ShareOpener reference={reference} onImport={onImport} onCancel={onClose} onDone={onClose} />
      </DialogBody>
    </Dialog>
  )
}
