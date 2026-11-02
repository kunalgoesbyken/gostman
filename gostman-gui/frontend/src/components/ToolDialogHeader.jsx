import { Badge } from "./ui/badge"
import { DialogHeader, DialogTitle } from "./ui/dialog"
import { LearnMore } from "./LearnMore"
import { featureBlurb, featureById, featureToolLabel, platformLabel } from "../lib/featureIndex"

export function ToolDialogHeader({ featureId, title, onClose, children }) {
  const feature = featureById(featureId)
  const purpose = featureBlurb(feature)
  const platforms = platformLabel(feature)
  return (
    <>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{title ?? featureToolLabel(feature)}</DialogTitle>
        {children}
      </DialogHeader>
      <div className="flex shrink-0 items-center gap-2 border-b border-border ps-4 pe-2 text-xs text-muted-foreground max-sm:flex-wrap max-sm:py-1">
        <p className="min-w-0 flex-1 truncate max-sm:basis-full max-sm:whitespace-normal" title={purpose}>{purpose}</p>
        {platforms && <Badge>{platforms}</Badge>}
        <LearnMore feature={feature} />
      </div>
    </>
  )
}
