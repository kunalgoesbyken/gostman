import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { SpecBrowserBody, SpecBrowserTabs, useSpecBrowser } from "./SpecBrowser"
import { SPEC_TEXT } from "../lib/specText"

export function SpecViewer({ dialog, actions, onClose }) {
  const browser = useSpecBrowser({ source: dialog.source, actions, initialTab: dialog.tab })

  return (
    <Dialog label={SPEC_TEXT.viewerTitle} size="lg" className="max-w-5xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{browser.summary.value?.info.title || SPEC_TEXT.viewerTitle}</DialogTitle>
        <SpecBrowserTabs browser={browser} className="ms-4 h-full" />
      </DialogHeader>
      <SpecBrowserBody browser={browser} />
    </Dialog>
  )
}
