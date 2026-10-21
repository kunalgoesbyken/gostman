import { ShieldCheck } from "lucide-react"
import { Notice } from "./ui/panel"
import { frameDocument } from "../lib/visualizeFrame"

const TEXT = {
  frameTitle: "Visualization",
  note: "Rendered from a script. Scripts, network access, forms and navigation are blocked inside this view.",
}

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
