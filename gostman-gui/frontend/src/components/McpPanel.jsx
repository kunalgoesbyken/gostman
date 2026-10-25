import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronRight, Info, Loader2, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Combobox } from "./ui/combobox"
import { Input } from "./ui/input"
import { Notice, Panel, SIDE_PANE, STACKED_TOOLBAR, SectionLabel, Toolbar, ToolbarSummary } from "./ui/panel"
import { Select } from "./ui/select"
import { EditorSkeleton } from "./ui/skeleton"
import { isBlankMessage } from "../lib/grpc"
import {
  MCP_CALL_TOOL, MCP_GET_PROMPT, MCP_OPERATIONS, MCP_READ_RESOURCE, findTool, isLocalCommand, mcpOperation, namesItem, takesArguments,
} from "../lib/mcp"
import { STEP_FAILED, STEP_RUNNING } from "../lib/mcpAuth"
import { checkCatalog, describeFinding } from "../lib/mcpChecks"
import { MCP_TEXT } from "../lib/mcpText"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const DETAIL_CLASS = "max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-2xs text-muted-foreground"
const SECTION_CLASS = "border-b border-border px-3 py-2 text-xs"
const OUTCOME_ICONS = { ok: Check, warning: AlertTriangle, failed: X, stopped: Info, [STEP_RUNNING]: Loader2 }
const OUTCOME_TONES = { ok: "text-success", warning: "text-warning", failed: "text-destructive", stopped: "text-muted-foreground", [STEP_RUNNING]: "text-muted-foreground" }
const OPEN_OUTCOMES = new Set(["warning", "failed", "stopped"])

const itemsFor = (catalog, operation) => {
  if (operation === MCP_CALL_TOOL) return catalog?.tools
  if (operation === MCP_GET_PROMPT) return catalog?.prompts
  return undefined
}

const resourceSuggestions = (catalog) => [
  ...(catalog?.resources ?? []).map((resource) => resource.uri),
  ...(catalog?.resourceTemplates ?? []).map((template) => template.uriTemplate),
]

const isEmptyCatalog = (catalog) => ["tools", "resources", "resourceTemplates", "prompts"].every((key) => catalog[key]?.length === 0)

function ItemField({ operation, items, catalog, value, onChange }) {
  const label = MCP_TEXT.itemLabels[operation]
  if (!items) {
    const isResource = operation === MCP_READ_RESOURCE
    const TextField = isResource ? Combobox : Input
    return (
      <TextField
        value={value}
        {...(isResource && { suggestions: resourceSuggestions(catalog) })}
        onChange={(event) => onChange(event.target.value)}
        placeholder={MCP_TEXT.placeholders[operation]}
        aria-label={label}
        spellCheck={false}
        className="font-mono"
      />
    )
  }
  const isListed = Boolean(findTool(items, value))
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="font-mono">
      <option value="">{MCP_TEXT.choose[operation]}</option>
      {value && !isListed && <option value={value}>{value}</option>}
      {items.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
    </Select>
  )
}

function CatalogNotice({ catalog, isLocal }) {
  if (catalog?.error) return <Notice tone="destructive" role="alert">{catalog.error}</Notice>
  if (!catalog?.tools) return <Notice>{isLocal ? MCP_TEXT.catalogHints.local : MCP_TEXT.catalogHints.remote}</Notice>
  if (isEmptyCatalog(catalog)) return <Notice tone="warning">{MCP_TEXT.empty}</Notice>
  return null
}

function Instructions({ text }) {
  return (
    <div className={SECTION_CLASS}>
      <SectionLabel>{MCP_TEXT.instructions}</SectionLabel>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{text}</p>
    </div>
  )
}

function ChangedTool({ change }) {
  const text = MCP_TEXT.changes
  if (change.before === undefined) return <p className="font-mono">{text.definitionChanged(change.name)}</p>
  if (change.before === change.after) return <p className="font-mono">{text.schemaChanged(change.name)}</p>
  return (
    <div className="space-y-1">
      <p className="font-mono">{text.descriptionChanged(change.name)}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 ps-3">
        <dt className="text-muted-foreground">{text.before}</dt>
        <dd className="whitespace-pre-wrap text-foreground">{change.before || text.noDescription}</dd>
        <dt className="text-muted-foreground">{text.now}</dt>
        <dd className="whitespace-pre-wrap text-foreground">{change.after || text.noDescription}</dd>
      </dl>
    </div>
  )
}

function ToolChanges({ changes, onAccept }) {
  const text = MCP_TEXT.changes
  if (changes.firstSeen) return <Notice icon={Info}>{text.firstSeen}</Notice>
  const lines = [
    changes.added.length > 0 && text.added(changes.added),
    changes.removed.length > 0 && text.removed(changes.removed),
  ].filter(Boolean)
  return (
    <div role="alert" className={cn(SECTION_CLASS, "text-warning")}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5 [overflow-wrap:anywhere]">
          <p className="font-medium">{text.title}</p>
          {lines.map((line) => <p key={line} className="font-mono">{line}</p>)}
          {changes.changed.map((change) => <ChangedTool key={change.name} change={change} />)}
          <p>{text.advice}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onAccept}>{text.accept}</Button>
      </div>
    </div>
  )
}

function Findings({ catalog, findings }) {
  if (findings.length === 0) return <Notice tone="success" icon={Check}>{MCP_TEXT.noFindings}</Notice>
  return (
    <ul className={cn(SECTION_CLASS, "space-y-1")}>
      {findings.map((finding) => (
        <li key={`${finding.code}-${finding.tool}-${finding.detail}`} className="flex items-start gap-2 text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 text-foreground [overflow-wrap:anywhere]">{describeFinding(finding, catalog)}</span>
        </li>
      ))}
    </ul>
  )
}

function StepHeading({ step, expandable }) {
  const text = MCP_TEXT.auth
  const Icon = OUTCOME_ICONS[step.outcome] ?? Info
  return (
    <span className="flex items-center gap-2">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", OUTCOME_TONES[step.outcome], step.outcome === STEP_RUNNING && "animate-spin")} />
      <span className="min-w-0 flex-1 font-medium text-foreground">{text.steps[step.step] ?? step.step}</span>
      <span className={cn("shrink-0 text-2xs", OUTCOME_TONES[step.outcome])}>{text.outcomes[step.outcome] ?? step.outcome}</span>
      <ChevronRight aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90", !expandable && "invisible")} />
    </span>
  )
}

function StepDetails({ step }) {
  const text = MCP_TEXT.auth
  return (
    <div className="space-y-1 pb-1 ps-5 pt-1">
      {step.problem && text.explanations[step.problem] && <p className="text-foreground">{text.explanations[step.problem]}</p>}
      {step.detail && <p className={DETAIL_CLASS}>{step.detail}</p>}
      {step.attempts?.length > 0 && (
        <ul className={DETAIL_CLASS} aria-label={text.attempts}>
          {step.attempts.map((attempt) => <li key={attempt.url}>{text.attempt(attempt)}</li>)}
        </ul>
      )}
    </div>
  )
}

const hasDetails = (step) => Boolean(step.problem || step.detail || step.attempts?.length)

function StepRow({ step, rowRef }) {
  if (!hasDetails(step)) {
    return <li ref={rowRef}><StepHeading step={step} expandable={false} /></li>
  }
  return (
    <li ref={rowRef}>
      <details open={OPEN_OUTCOMES.has(step.outcome)} className="group">
        <summary className="cursor-pointer list-none rounded-sm [&::-webkit-details-marker]:hidden">
          <StepHeading step={step} expandable />
        </summary>
        <StepDetails step={step} />
      </details>
    </li>
  )
}

const focusIndex = (steps) => {
  const failed = steps.findIndex((step) => step.outcome === STEP_FAILED)
  return failed >= 0 ? failed : steps.length - 1
}

function SignInTimeline({ auth, onClose, onRetry }) {
  const focusRef = useRef(null)
  const focused = focusIndex(auth.steps)
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest" })
  }, [focused, auth.running])
  return (
    <div className={SECTION_CLASS}>
      <div className="mb-2 flex items-center gap-2">
        <SectionLabel className="flex-1">{MCP_TEXT.auth.title}</SectionLabel>
        {!auth.running && <Button variant="ghost" size="sm" onClick={onRetry}>{MCP_TEXT.auth.retry}</Button>}
        {!auth.running && <Button variant="ghost" size="sm" onClick={onClose}>{MCP_TEXT.auth.close}</Button>}
      </div>
      <ol className="space-y-1.5">
        {auth.steps.map((step, index) => (
          <StepRow key={`${step.step}-${index}`} step={step} rowRef={index === focused ? focusRef : undefined} />
        ))}
      </ol>
    </div>
  )
}

function SchemaPane({ operation, item, onClose }) {
  const isPrompt = operation === MCP_GET_PROMPT
  const detail = isPrompt ? MCP_TEXT.promptArguments(item) : item.inputSchema
  return (
    <aside aria-label={MCP_TEXT.schemaTitles[operation]} className={cn(SIDE_PANE, "w-2/5 min-w-52 max-w-md")}>
      <Toolbar>
        <SectionLabel className="min-w-0 flex-1 truncate">{MCP_TEXT.schemaTitles[operation]}</SectionLabel>
        <IconButton label={MCP_TEXT.closeSchema} icon={X} onClick={onClose} />
      </Toolbar>
      <pre dir="ltr" className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {detail || MCP_TEXT.noArguments}
      </pre>
    </aside>
  )
}

const selectSignIn = (tabId) => (state) => state.tabs.find((tab) => tab.id === tabId)?.mcpAuth

const isUntouched = (argumentsText, item) => isBlankMessage(argumentsText) || argumentsText === item?.skeleton

export function McpPanel({ tabId, request, catalog, editorPath, onUpdateRequest, onLoadCatalog, onAcceptTools, onSignIn, onCloseSignIn, EditorComponent }) {
  const { mcpTool, mcpArguments } = request
  const operation = mcpOperation(request)
  const [showsSchema, setShowsSchema] = useState(false)
  const [showsChecks, setShowsChecks] = useState(false)
  const [showsInstructions, setShowsInstructions] = useState(false)
  const signIn = useAppStore(selectSignIn(tabId))
  const isLocal = isLocalCommand(request)

  const isLoaded = Boolean(catalog?.tools)
  const items = itemsFor(catalog, operation)
  const selected = useMemo(() => (items ? findTool(items, mcpTool) : undefined), [items, mcpTool])
  const findings = useMemo(() => (isLoaded ? checkCatalog(catalog) : []), [isLoaded, catalog])
  const serverSummary = isLoaded ? MCP_TEXT.serverLabel(catalog) : MCP_TEXT.notLoaded

  const chooseOperation = (next) => {
    if (next === operation) return
    const cleared = isUntouched(mcpArguments, selected) ? { mcpArguments: "" } : {}
    onUpdateRequest({ mcpMethod: next === MCP_CALL_TOOL ? "" : next, mcpTool: "", ...cleared })
    setShowsSchema(false)
  }

  const chooseItem = (name) => {
    const chosen = items ? findTool(items, name) : undefined
    const prefill = chosen?.skeleton && isUntouched(mcpArguments, selected) ? { mcpArguments: chosen.skeleton } : {}
    onUpdateRequest({ mcpTool: name, ...prefill })
  }

  return (
    <Panel className="relative">
      <Toolbar className={STACKED_TOOLBAR}>
        <ToolbarSummary label={MCP_TEXT.server} title={serverSummary}>{serverSummary}</ToolbarSummary>
        {isLoaded && catalog.instructions && (
          <Button variant="outline" size="sm" aria-pressed={showsInstructions} title={MCP_TEXT.instructionsHint} onClick={() => setShowsInstructions(!showsInstructions)}>
            {MCP_TEXT.instructions}
          </Button>
        )}
        {isLoaded && (
          <Button variant="outline" size="sm" aria-pressed={showsChecks} title={MCP_TEXT.checksHint} onClick={() => setShowsChecks(!showsChecks)}>
            {MCP_TEXT.checks}
            <span className={cn("ms-1 font-mono", findings.length > 0 ? "text-warning" : "text-muted-foreground")}>{findings.length}</span>
          </Button>
        )}
        {!isLocal && (
          <Button variant="outline" size="sm" disabled={Boolean(signIn?.running)} title={MCP_TEXT.signInHint} onClick={onSignIn}>
            {signIn?.running ? MCP_TEXT.signingIn : MCP_TEXT.signIn}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={Boolean(catalog?.loading)} onClick={onLoadCatalog}>
          {isLoaded ? MCP_TEXT.reload : MCP_TEXT.load}
        </Button>
      </Toolbar>
      <div className="max-h-[60%] min-h-0 overflow-y-auto">
        <CatalogNotice catalog={catalog} isLocal={isLocal} />
        {signIn && <SignInTimeline auth={signIn} onClose={onCloseSignIn} onRetry={onSignIn} />}
        {catalog?.changes && <ToolChanges changes={catalog.changes} onAccept={onAcceptTools} />}
        {isLoaded && showsChecks && <Findings catalog={catalog} findings={findings} />}
        {isLoaded && showsInstructions && catalog.instructions && <Instructions text={catalog.instructions} />}
      </div>
      <Toolbar>
        <Select value={operation} onChange={(event) => chooseOperation(event.target.value)} aria-label={MCP_TEXT.operation} className="w-auto shrink-0">
          {MCP_OPERATIONS.map((candidate) => <option key={candidate} value={candidate}>{MCP_TEXT.operations[candidate]}</option>)}
        </Select>
        {namesItem(operation) && (
          <div className="min-w-0 flex-1">
            <ItemField operation={operation} items={items} catalog={catalog} value={mcpTool} onChange={chooseItem} />
          </div>
        )}
        {takesArguments(operation) && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected}
              aria-pressed={showsSchema}
              title={MCP_TEXT.schemaHints[operation]}
              onClick={() => setShowsSchema(!showsSchema)}
            >
              {MCP_TEXT.schema}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selected}
              title={MCP_TEXT.exampleHint}
              onClick={() => onUpdateRequest({ mcpArguments: selected.skeleton })}
            >
              {MCP_TEXT.example}
            </Button>
          </>
        )}
      </Toolbar>
      {selected?.description && <Notice className="max-h-24 overflow-y-auto whitespace-pre-wrap">{selected.description}</Notice>}
      {operation === MCP_READ_RESOURCE && <Notice>{MCP_TEXT.readHint}</Notice>}
      {!namesItem(operation) && <Notice>{MCP_TEXT.noInput}</Notice>}
      {takesArguments(operation) && (
        <div className="flex min-h-24 flex-1">
          <div dir="ltr" className="min-h-0 min-w-0 flex-1">
            <Suspense fallback={<EditorSkeleton />}>
              <EditorComponent
                value={mcpArguments}
                onChange={(event) => onUpdateRequest({ mcpArguments: event.target.value })}
                label={MCP_TEXT.argumentsLabel}
                language="json"
                path={editorPath}
                variables
                fileReads={false}
                height="100%"
                surface="body"
              />
            </Suspense>
          </div>
          {showsSchema && selected && <SchemaPane operation={operation} item={selected} onClose={() => setShowsSchema(false)} />}
        </div>
      )}
    </Panel>
  )
}
