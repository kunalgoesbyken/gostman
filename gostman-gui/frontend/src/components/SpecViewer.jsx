import { useEffect, useMemo, useState } from "react"
import { FileJson, Loader2, Search, Send } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { SPLIT_LIST, SPLIT_PANES } from "./ui/panel"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { VirtualList } from "./ui/VirtualList"
import { MethodTag } from "./MethodTag"
import { SchemaTree } from "./SchemaTree"
import { SearchField } from "./SearchField"
import { SpecLint } from "./SpecLint"
import { SPEC_TEXT } from "../lib/specText"
import { cn } from "../lib/utils"

const ROW_HEIGHT_PX = 28
const TAB_OPERATIONS = "operations"
const TAB_MODELS = "models"
const TAB_LINT = "lint"
const UNTAGGED = ""

const matches = (query) => (...fields) => fields.some((field) => field?.toLocaleLowerCase().includes(query))

function groupRows(summary, query) {
  const needle = query.trim().toLocaleLowerCase()
  const test = matches(needle)
  const visible = summary.operations.filter((operation) => (
    needle === "" || test(operation.key, operation.summary, operation.operationId, ...(operation.tags || []))
  ))
  const groups = new Map()
  visible.forEach((operation) => {
    const tag = operation.tags?.[0] ?? UNTAGGED
    groups.set(tag, [...(groups.get(tag) || []), operation])
  })
  const order = [...summary.tags.map((tag) => tag.name), UNTAGGED].filter((tag) => groups.has(tag))
  return order.flatMap((tag) => [{ kind: "tag", key: `tag:${tag}`, tag }, ...groups.get(tag).map((operation) => ({ kind: "op", key: operation.key, operation }))])
}

function OperationRow({ row, isActive, onSelect }) {
  if (row.kind === "tag") {
    return (
      <div style={{ height: ROW_HEIGHT_PX }} className="flex items-center px-3 text-xs font-semibold text-foreground">
        <span className="truncate">{row.tag || SPEC_TEXT.untagged}</span>
      </div>
    )
  }
  const { operation } = row
  return (
    <button
      type="button"
      style={{ height: ROW_HEIGHT_PX }}
      onClick={() => onSelect(operation.key)}
      title={operation.summary || operation.key}
      className={cn("flex w-full items-center gap-2 px-3 text-left text-xs", isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
    >
      <MethodTag method={operation.method} className="w-12" />
      <span className={cn("truncate", operation.deprecated && "line-through")}>{operation.path}</span>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-2 pt-4">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Example({ text }) {
  if (!text) return null
  return <pre className="max-h-48 overflow-auto rounded-md border border-border p-2 font-mono text-[11px]">{text}</pre>
}

function Bodies({ bodies }) {
  return bodies.map((body) => (
    <div key={body.contentType} className="space-y-2">
      <Badge variant="outline">{body.contentType}</Badge>
      {body.schema && <SchemaTree node={body.schema} />}
      <Example text={body.example} />
    </div>
  ))
}

function OperationDetail({ detail, onSend }) {
  const { operation } = detail
  return (
    <div className="p-4">
      <div className="flex items-start gap-2">
        <MethodTag method={operation.method} className="pt-0.5" />
        <h2 className="min-w-0 flex-1 font-mono text-sm [overflow-wrap:anywhere]">{operation.path}</h2>
        <Button size="sm" onClick={onSend}>
          <Send />
          {SPEC_TEXT.sendToTab}
        </Button>
      </div>
      {operation.deprecated && <Badge className="mt-2">{SPEC_TEXT.deprecated}</Badge>}
      {operation.summary && <p className="pt-2 text-xs font-medium">{operation.summary}</p>}
      {detail.description && <p className="whitespace-pre-wrap pt-2 text-xs text-muted-foreground">{detail.description}</p>}
      {detail.security.length > 0 && (
        <Section title={SPEC_TEXT.security}>
          {detail.security.map((entry) => <p key={entry} className="text-xs">{entry}</p>)}
        </Section>
      )}
      {detail.parameters.length > 0 && (
        <Section title={SPEC_TEXT.parameters}>
          {detail.parameters.map((parameter) => (
            <SchemaTree key={`${parameter.in}:${parameter.name}`} node={{ ...parameter.schema, name: `${parameter.name} (${parameter.in})`, required: parameter.required, description: parameter.description || parameter.schema.description }} />
          ))}
        </Section>
      )}
      {detail.bodies.length > 0 && (
        <Section title={SPEC_TEXT.requestBody}>
          <Bodies bodies={detail.bodies} />
        </Section>
      )}
      {detail.responses.length > 0 && (
        <Section title={SPEC_TEXT.responses}>
          {detail.responses.map((response) => (
            <div key={response.status} className="space-y-2">
              <p className="text-xs"><span className="font-mono font-semibold">{response.status}</span> {response.description}</p>
              <Bodies bodies={response.bodies} />
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function useLoaded(load, deps) {
  const [state, setState] = useState({ value: null, error: "", isLoading: false })
  useEffect(() => {
    if (load === null) {
      setState({ value: null, error: "", isLoading: false })
      return undefined
    }
    let isCurrent = true
    setState((current) => ({ ...current, error: "", isLoading: true }))
    load().then(
      (value) => isCurrent && setState({ value, error: "", isLoading: false }),
      (error) => isCurrent && setState({ value: null, error: error.message, isLoading: false }),
    )
    return () => {
      isCurrent = false
    }
  }, deps)
  return state
}

function Status({ state, children }) {
  if (state.isLoading) {
    return <p role="status" className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{SPEC_TEXT.loading}</p>
  }
  if (state.error) return <p role="alert" className="p-4 text-xs text-destructive [overflow-wrap:anywhere]">{state.error}</p>
  return children
}

function ModelList({ names, query, selected, onSelect }) {
  const needle = query.trim().toLocaleLowerCase()
  const shown = names.filter((name) => needle === "" || name.toLocaleLowerCase().includes(needle))
  if (shown.length === 0) return <EmptyState icon={Search} title={SPEC_TEXT.noModels} />
  const renderRow = (name) => (
    <button
      key={name}
      type="button"
      style={{ height: ROW_HEIGHT_PX }}
      onClick={() => onSelect(name)}
      className={cn("flex w-full items-center px-3 text-left font-mono text-xs", name === selected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
    >
      <span className="truncate">{name}</span>
    </button>
  )
  return <VirtualList items={shown} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} className="h-full py-1" />
}

export function SpecViewer({ dialog, actions, onClose }) {
  const { source } = dialog
  const [tab, setTab] = useState(dialog.tab || TAB_OPERATIONS)
  const [hasOpenedLint, setHasOpenedLint] = useState(tab === TAB_LINT)
  const [query, setQuery] = useState("")
  const [operationKey, setOperationKey] = useState(null)
  const [modelName, setModelName] = useState(null)

  const changeTab = (value) => {
    setTab(value)
    if (value === TAB_LINT) setHasOpenedLint(true)
  }

  const openOperation = (key) => {
    setQuery("")
    setOperationKey(key)
    setTab(TAB_OPERATIONS)
  }

  const summary = useLoaded(() => actions.summary(source), [source])
  const lint = useLoaded(hasOpenedLint ? () => actions.lint(source) : null, [source, hasOpenedLint])
  const detail = useLoaded(operationKey === null ? null : () => actions.operation(source, operationKey), [source, operationKey])
  const model = useLoaded(modelName === null ? null : () => actions.schema(source, modelName), [source, modelName])

  const rows = useMemo(() => (summary.value ? groupRows(summary.value, query) : []), [summary.value, query])
  const isOperations = tab === TAB_OPERATIONS

  const renderRow = (row) => <OperationRow key={row.key} row={row} isActive={row.key === operationKey} onSelect={setOperationKey} />

  return (
    <Dialog label={SPEC_TEXT.viewerTitle} size="lg" className="max-w-5xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{summary.value?.info.title || SPEC_TEXT.viewerTitle}</DialogTitle>
        <Tabs value={tab} onValueChange={changeTab} className="ml-4 h-full">
          <TabsList label={SPEC_TEXT.viewerTitle}>
            <TabsTrigger value={TAB_OPERATIONS}>{SPEC_TEXT.operations}</TabsTrigger>
            <TabsTrigger value={TAB_MODELS}>{SPEC_TEXT.models}</TabsTrigger>
            <TabsTrigger value={TAB_LINT}>{SPEC_TEXT.lint}</TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>
      <Status state={summary}>
        {summary.value && tab === TAB_LINT && (
          <Status state={lint}>
            {lint.value && <SpecLint report={lint.value} onOpenOperation={openOperation} />}
          </Status>
        )}
        {summary.value && tab !== TAB_LINT && (
          <div className={SPLIT_PANES}>
            <div className={cn(SPLIT_LIST, "w-72 max-sm:h-2/5")}>
              <SearchField value={query} onChange={setQuery} placeholder={isOperations ? SPEC_TEXT.searchOperations : SPEC_TEXT.searchModels} />
              <div className="min-h-0 flex-1">
                {isOperations ? (
                  rows.length === 0
                    ? <EmptyState icon={Search} title={SPEC_TEXT.noOperations} />
                    : <VirtualList items={rows} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} className="h-full py-1" />
                ) : (
                  <ModelList names={summary.value.schemas} query={query} selected={modelName} onSelect={setModelName} />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto">
              {isOperations ? (
                <Status state={detail}>
                  {detail.value
                    ? <OperationDetail detail={detail.value} onSend={() => actions.sendToTab(detail.value, summary.value.variables)} />
                    : <EmptyState icon={FileJson} title={SPEC_TEXT.pickOperation} />}
                </Status>
              ) : (
                <Status state={model}>
                  {model.value
                    ? <div className="p-4"><SchemaTree node={model.value} /></div>
                    : <EmptyState icon={FileJson} title={SPEC_TEXT.pickModel} />}
                </Status>
              )}
            </div>
          </div>
        )}
      </Status>
    </Dialog>
  )
}
