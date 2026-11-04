import { docPath } from "../../docs/manifest"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { BrandStrip } from "../ui/brandIcon"
import { Check, Copy } from "./icons"

const AGENT_BRANDS = ["claude", "openai", "gemini", "cursor", "vscode"]
const SETUP_COMMAND = "gostman init --skill"

export function AgentStart({ className }) {
  const { copied, copy } = useClipboardCopy(SETUP_COMMAND)
  const Icon = copied ? Check : Copy
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-3 ${className ?? ""}`}>
      <BrandStrip brands={AGENT_BRANDS} className="gap-4" />
      <a href={docPath("agents")} className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
        For your coding agent
      </a>
      <button type="button" onClick={copy} aria-label={`Copy ${SETUP_COMMAND}`} className="inline-flex items-center gap-2 font-mono text-sm text-foreground">
        {SETUP_COMMAND}
        <Icon className={copied ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5 text-muted-foreground"} aria-hidden="true" />
      </button>
    </div>
  )
}
