import { ShieldCheck } from "lucide-react"
import { Notice } from "./ui/panel"
import { frameDocument } from "../lib/visualizeFrame"
import { VISUALIZE_TEXT as TEXT } from "../lib/responseText"

export function VisualizeTab({ html }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Notice icon={ShieldCheck}>{TEXT.note}</Notice>
      <iframe
        srcDoc={frameDocument(html)}
        title={TEXT.frameTitle}
        sandbox=""
        referrerPolicy="no-referrer"
        className="block min-h-0 w-full flex-1 border-none bg-white"
      />
    </div>
  )
}
