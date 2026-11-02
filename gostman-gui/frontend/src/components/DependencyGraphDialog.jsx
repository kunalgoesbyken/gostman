import { useMemo, useState } from "react"
import { Workflow } from "lucide-react"
import { DependencyGraph } from "./DependencyGraph"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Notice, SectionLabel } from "./ui/panel"
import { TabCount } from "./ui/tabs"
import { STATUS_DEFINED, buildDependencyGraph, definedVariableNames } from "../lib/dependencies/graph"
import { GAP_PX, NODE_WIDTH_PX, PADDING_PX } from "../lib/dependencies/layout"
import { DEPENDENCIES_TEXT } from "../lib/dependenciesText"
import { formatList } from "../lib/i18n/format"
import { NO_TAG_FILTER, requestsInScope } from "../lib/runner"
import { useAppStore } from "../store/appStore"

const REFERENCE_EXAMPLE = "{{name}}"
const GRAPH_WINDOW = { id: "dependencies", width: 960, height: 600, minWidth: 560, minHeight: 360 }

function useDependencyGraph(folders, requests, folderId, showInputs) {
  const environments = useAppStore((s) => s.environments)
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const collectionVariables = useAppStore((s) => s.collectionVariables)
  const sharedOrder = useAppStore((s) => s.sharedOrder)
  return useMemo(() => {
    const scopeIds = new Set(requestsInScope({ folders, requests, sharedOrder }, folderId, NO_TAG_FILTER).map((request) => request.id))
    const defined = definedVariableNames({ environments, globalEnvironments, collectionVariables, folders })
    const graph = buildDependencyGraph({ requests, defined, scopeIds })
    return { ...graph, shown: graph.variables.filter((variable) => showInputs || variable.status !== STATUS_DEFINED) }
  }, [folders, requests, folderId, showInputs, environments, globalEnvironments, collectionVariables, sharedOrder])
}

const scopeLabel = (folders, folderId) => {
  const folder = folders.find((item) => item.id === folderId)
  return folder ? DEPENDENCIES_TEXT.scopeFolder(folder.name) : DEPENDENCIES_TEXT.scopeAll
}

export function DependencyGraphDialog({ folders, requests, actions }) {
  const folderId = useAppStore((s) => s.dependencyGraph.folderId)
  const close = useAppStore((s) => s.closeDependencyGraph)
  const [showInputs, setShowInputs] = useState(false)
  const { shown, missing } = useDependencyGraph(folders, requests, folderId, showInputs)
  const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])
  const open = (requestId) => {
    close()
    actions.goToRequest(requestId)
  }

  return (
    <Dialog label={DEPENDENCIES_TEXT.title} size="lg" floating={GRAPH_WINDOW} onClose={close}>
      <DialogHeader onClose={close}>
        <DialogTitle>{DEPENDENCIES_TEXT.title}</DialogTitle>
        <TabCount>{shown.length}</TabCount>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{scopeLabel(folders, folderId)}</span>
      </DialogHeader>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 pb-2 pt-3">
        <p className="text-xs text-muted-foreground">{DEPENDENCIES_TEXT.intro(REFERENCE_EXAMPLE)}</p>
        <Checkbox checked={showInputs} onChange={(event) => setShowInputs(event.target.checked)} className="h-7 justify-start self-start">
          {DEPENDENCIES_TEXT.showInputs}
        </Checkbox>
      </div>
      {missing.length > 0 && (
        <Notice tone="warning">
          <strong className="me-1 font-medium">{DEPENDENCIES_TEXT.missingTitle}</strong>
          {DEPENDENCIES_TEXT.missingDetail(formatList(missing.map((variable) => variable.name)))}
        </Notice>
      )}
      {shown.length === 0 ? (
        <EmptyState icon={Workflow} title={DEPENDENCIES_TEXT.none} description={DEPENDENCIES_TEXT.noneDescription} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div dir="ltr" className="flex shrink-0 overflow-hidden border-b border-border py-1.5" style={{ paddingInlineStart: PADDING_PX, gap: GAP_PX }}>
            {[DEPENDENCIES_TEXT.producers, DEPENDENCIES_TEXT.variables, DEPENDENCIES_TEXT.consumers].map((label) => (
              <SectionLabel key={label} style={{ width: NODE_WIDTH_PX }}>{label}</SectionLabel>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <DependencyGraph variables={shown} requestsById={requestsById} onOpenRequest={open} />
          </div>
        </div>
      )}
    </Dialog>
  )
}
