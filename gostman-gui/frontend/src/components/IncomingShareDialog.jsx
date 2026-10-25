import { Dialog, DialogBody, DialogHeader, DialogTitle } from "./ui/dialog"
import { ShareOpener } from "./ShareOpener"
import { SHARE_OPEN_TEXT } from "../lib/shareText"

export function IncomingShareDialog({ reference, onImport, onClose }) {
  return (
    <Dialog label={SHARE_OPEN_TEXT.dialogLabel} className="max-w-xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{SHARE_OPEN_TEXT.title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="pb-3 text-xs text-muted-foreground">
          {SHARE_OPEN_TEXT.intro}
        </p>
        <ShareOpener reference={reference} onImport={onImport} onCancel={onClose} onDone={onClose} />
      </DialogBody>
    </Dialog>
  )
}
