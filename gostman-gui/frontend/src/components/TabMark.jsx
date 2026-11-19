import { FileCode, Workflow } from "lucide-react"
import { MethodTag } from "./MethodTag"
import { shownMethod } from "../lib/methodLabel"
import { cn } from "../lib/utils"

const ICON_CLASS = "h-3.5 w-3.5 shrink-0"

export function TabMark({ tab, compact = false, className }) {
  if (tab.flowId) return <Workflow aria-hidden="true" className={cn(ICON_CLASS, className)} />
  if (tab.specId) return <FileCode aria-hidden="true" className={cn(ICON_CLASS, className)} />
  return <MethodTag compact={compact} method={shownMethod(tab.request)} />
}
