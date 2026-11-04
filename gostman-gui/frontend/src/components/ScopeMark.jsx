import { Clock, FolderTree, Globe, Layers, Repeat, Send, Variable, Workflow } from "lucide-react"
import { VARIABLE_TEXT } from "../lib/variablesText"
import { cn } from "../lib/utils"

export const SCOPE_MARKS = {
  environment: { icon: Layers, tone: "text-info" },
  session: { icon: Clock, tone: "text-primary" },
  collection: { icon: FolderTree, tone: "text-success" },
  global: { icon: Globe, tone: "text-muted-foreground" },
  flowLoop: { icon: Repeat, tone: "text-primary" },
  flowSend: { icon: Send, tone: "text-info" },
  flowCall: { icon: Workflow, tone: "text-info" },
  flowRun: { icon: Variable, tone: "text-syntax-key" },
}

export const hasScopeMark = (source) => Object.hasOwn(SCOPE_MARKS, source)

export function ScopeMark({ source, label, className }) {
  if (!hasScopeMark(source)) return null
  const { icon: Icon, tone } = SCOPE_MARKS[source]
  return (
    <span title={VARIABLE_TEXT.sources[source]} className={cn("inline-flex min-w-0 shrink-0 items-center gap-1", className)}>
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", tone)} />
      {label !== undefined && <span className="truncate">{label || VARIABLE_TEXT.sources[source]}</span>}
    </span>
  )
}
