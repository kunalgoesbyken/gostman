import { X } from "lucide-react"
import { MethodTag } from "./MethodTag"
import { ResponsePanel } from "./ResponsePanel"
import { IconButton } from "./ui/button"
import { Toolbar } from "./ui/panel"
import { shownMethod } from "../lib/methodLabel"
import { SPLIT_TEXT } from "../lib/splitText"
import { tabTitle } from "../lib/tabDisplay"

export function BesideResponse({ tab, onClose, onExportCalls }) {
  return (
    <section aria-label={SPLIT_TEXT.pane} className="flex min-h-0 min-w-0 flex-1 flex-col border-s border-border max-md:hidden">
      <Toolbar className="gap-2 ps-3 pe-1.5">
        <MethodTag compact method={shownMethod(tab.request)} />
        <span dir="auto" className="min-w-0 flex-1 truncate text-xs text-foreground">{tabTitle(tab)}</span>
        <IconButton label={SPLIT_TEXT.close} icon={X} onClick={onClose} />
      </Toolbar>
      <ResponsePanel docked tabId={tab.id} jsonDepth={tab.request.jsonDepth} response={tab.response} history={tab.responses} tests={tab.tests} loading={tab.pendingId !== null} onExportCalls={onExportCalls} />
    </section>
  )
}
