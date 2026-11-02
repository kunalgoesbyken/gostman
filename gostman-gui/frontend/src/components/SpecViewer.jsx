import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { toolWindow } from "../lib/dialogWindows"
import { SpecBrowserBody, SpecBrowserTabs, useSpecBrowser } from "./SpecBrowser"
import { SPEC_TEXT } from "../lib/specText"

const SPEC_VIEWER_WINDOW = toolWindow("spec-viewer", "wide")

export function SpecViewer({ dialog, actions, onClose }) {
  const browser = useSpecBrowser({ source: dialog.source, actions, initialTab: dialog.tab })

  return (
    <Dialog label={SPEC_TEXT.viewerTitle} size="lg" floating={SPEC_VIEWER_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{browser.summary.value?.info.title || SPEC_TEXT.viewerTitle}</DialogTitle>
        <SpecBrowserTabs browser={browser} className="ms-4 h-full" />
      </DialogHeader>
      <SpecBrowserBody browser={browser} />
    </Dialog>
  )
}
