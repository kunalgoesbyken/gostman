import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "./button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

const VARIANT_ICONS = {
  warning: { icon: AlertTriangle, tone: "text-warning" },
  success: { icon: CheckCircle2, tone: "text-success" },
}

function VariantIcon({ variant }) {
  const view = VARIANT_ICONS[variant]
  if (!view) return null
  const Icon = view.icon
  return <Icon className={`h-4 w-4 shrink-0 ${view.tone}`} />
}

export function AlertDialog({ isOpen, title, message, confirmText, variant, onConfirm }) {
  if (!isOpen) return null

  return (
    <Dialog label={title} onClose={onConfirm}>
      <DialogHeader>
        <VariantIcon variant={variant} />
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{message}</p>
      </DialogBody>
      <DialogFooter>
        <Button autoFocus onClick={onConfirm}>{confirmText}</Button>
      </DialogFooter>
    </Dialog>
  )
}
