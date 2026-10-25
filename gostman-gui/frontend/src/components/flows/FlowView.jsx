import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Play, Redo2, Save, Square, Undo2, Workflow } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { Field } from "../ui/field"
import { Input } from "../ui/input"
import { PANE_WIDTH, ResizablePane, SPLIT_PANES, SectionLabel } from "../ui/panel"
import { EDGE_START } from "../../hooks/usePaneResize"
import { FLOW_PANE } from "../../lib/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Textarea } from "../ui/textarea"
import { FlowCanvas } from "./FlowCanvas"
import { FlowRunPanel } from "./FlowRunPanel"
import { RequestPicker } from "./RequestPicker"
import { StepEditor } from "./StepEditor"
import { useShortcutLabel } from "../../hooks/useShortcuts"
import { FLOW_CANVAS_TEXT, FLOW_VIEW_TEXT as TEXT } from "../../lib/flowsText"
import { requestCatalog } from "../../lib/flows/catalog"
import { duplicateStep, insertStep, isFlowDirty, moveStep, newStep, removeStep, renameStep, updateStep } from "../../lib/flows/edit"
import { RUN_RUNNING, useFlowRunStore } from "../../lib/flows/flowRunner"
import { canRedo, canUndo, recordChange, redoChange, undoChange } from "../../lib/flows/history"
import { MAX_SENDS_CAP, STEP_REQUEST, indexSteps, normalizeFlow } from "../../lib/flows/model"
import { stepTitle, validateFlow } from "../../lib/flows/validate"
import { hintWithShortcut } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/appStore"

const PANEL_STEP = "step"
const PANEL_RUN = "run"
const UNDO_KEY = "z"
const REDO_KEY = "y"
const EDITING_TAGS = ["INPUT", "TEXTAREA", "SELECT"]

const isEditingText = (element) => EDITING_TAGS.includes(element?.tagName) || element?.isContentEditable

const store = () => useAppStore.getState()

function groupProblems(problems) {
  const byStep = new Map()
  problems.forEach(({ step, message }) => byStep.set(step, [...(byStep.get(step) || []), message]))
  return byStep
}

function FlowSettings({ flow, problems, index, requests, onChange, onSelectStep }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 [overflow-wrap:anywhere]">
      <SectionLabel>{TEXT.settingsTitle}</SectionLabel>
      <p className="text-xs text-muted-foreground">{TEXT.selectHint}</p>
      <Field label={TEXT.description}>
        <Textarea rows={3} value={flow.description} placeholder={TEXT.descriptionPlaceholder} onChange={(event) => onChange({ ...flow, description: event.target.value }, "description")} className="font-sans" />
      </Field>
      <Field label={TEXT.maxSends}>
        <Input type="number" min={1} max={MAX_SENDS_CAP} value={flow.maxSends} onChange={(event) => onChange({ ...flow, maxSends: event.target.value }, "maxSends")} className="w-28 font-mono" />
      </Field>
      <p className="text-2xs text-muted-foreground">{TEXT.maxSendsHint(MAX_SENDS_CAP)}</p>
      {problems.length > 0 && (
        <section className="flex flex-col gap-1 rounded-md border border-warning/40 p-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
            {TEXT.problems(problems.length)}
          </p>
          <ul className="flex flex-col">
            {problems.map(({ step, message }, position) => (
              <li key={position}>
                <button type="button" disabled={!step} onClick={() => onSelectStep(step)} className="w-full rounded px-1 py-0.5 text-start text-xs text-foreground hover:bg-accent disabled:hover:bg-transparent">
                  {step && index.get(step) ? `${stepTitle(index.get(step).step, requests)}: ` : ""}{message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-2xs text-muted-foreground">{TEXT.cliHint}</p>
        <code className="select-all rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-2xs text-foreground">{TEXT.cli(flow.name)}</code>
      </div>
    </div>
  )
}

function FlowToolbar({ flow, isDirty, isRunning, history, onRename, onSave, onRun, onStop, onUndo, onRedo }) {
  const saveShortcut = useShortcutLabel("saveRequest")
  const runShortcut = useShortcutLabel("sendRequest")
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
      <Workflow aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input value={flow.name} aria-label={TEXT.nameLabel} onChange={(event) => onRename(event.target.value)} className="h-7 max-w-xs border-transparent text-sm font-medium hover:border-input focus:border-input" />
      {isDirty && <span aria-label={TEXT.unsaved} title={TEXT.unsaved} className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />}
      <div className="ms-auto flex shrink-0 items-center gap-1">
        <IconButton label={TEXT.undo} icon={Undo2} mirrored disabled={!history.canUndo} onClick={onUndo} />
        <IconButton label={TEXT.redo} icon={Redo2} mirrored disabled={!history.canRedo} onClick={onRedo} className="max-sm:hidden" />
        <Button variant="outline" size="sm" disabled={!isDirty} onClick={onSave} title={hintWithShortcut(TEXT.save, saveShortcut)}>
          <Save />
          <span className="max-sm:hidden">{TEXT.save}</span>
        </Button>
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={onStop}>
            <Square />
            {TEXT.stop}
          </Button>
        ) : (
          <Button size="sm" onClick={onRun} disabled={flow.steps.length === 0} title={hintWithShortcut(TEXT.run, runShortcut)}>
            <Play />
            {TEXT.run}
          </Button>
        )}
      </div>
    </div>
  )
}

function focusEditor() {
  requestAnimationFrame(() => document.querySelector("[data-flow-editor] input, [data-flow-editor] button")?.focus())
}

function focusNode(id) {
  requestAnimationFrame(() => document.querySelector(`[data-step-node="${CSS.escape(id)}"]`)?.focus())
}

export function FlowView({ tab, actions, EditorComponent }) {
  const flow = tab.flowDraft
  const requests = useAppStore((s) => s.requests)
  const folders = useAppStore((s) => s.folders)
  const saved = useAppStore((s) => s.flows.find((candidate) => candidate.id === tab.flowId))
  const run = useFlowRunStore((s) => s.runs[tab.id])
  const catalog = useMemo(() => requestCatalog(requests, folders), [requests, folders])
  const context = useMemo(() => ({ requests: catalog, index: indexSteps(flow.steps) }), [catalog, flow.steps])
  const problems = useMemo(() => validateFlow(normalizeFlow(flow), catalog), [flow, catalog])
  const problemsByStep = useMemo(() => groupProblems(problems), [problems])
  const isDirty = useMemo(() => isFlowDirty(flow, saved), [flow, saved])
  const isRunning = run?.status === RUN_RUNNING
  const [selected, setSelected] = useState("")
  const [panel, setPanel] = useState(PANEL_STEP)
  const [picker, setPicker] = useState(null)
  const [, setVersion] = useState(0)
  const selectedStep = context.index.get(selected)?.step

  useEffect(() => {
    if (isRunning) setPanel(PANEL_RUN)
  }, [isRunning])

  const change = useCallback((next, group = "") => {
    recordChange(tab.id, store().tabs.find((candidate) => candidate.id === tab.id)?.flowDraft ?? flow, group)
    actions.updateDraft(tab.id, next)
    setVersion((version) => version + 1)
  }, [actions, flow, tab.id])

  const travel = useCallback((move) => {
    const target = move(tab.id, flow)
    if (!target) return
    actions.updateDraft(tab.id, target)
    setVersion((version) => version + 1)
  }, [actions, flow, tab.id])

  const select = useCallback((id) => {
    setSelected(id)
    setPanel(PANEL_STEP)
  }, [])

  const open = useCallback((id) => {
    select(id)
    focusEditor()
  }, [select])

  const insert = useCallback((place, kind, fields = {}, name = "") => {
    const step = newStep(flow, kind, fields, name)
    change(insertStep(flow, place, step))
    select(step.id)
    focusNode(step.id)
  }, [change, flow, select])

  const chooseKind = useCallback((place, kind) => {
    if (kind === STEP_REQUEST) setPicker({ place })
    else insert(place, kind)
  }, [insert])

  const chooseRequest = (request) => {
    const fields = { request: request.path, requestId: request.id }
    if (picker.stepId) change(updateStep(flow, picker.stepId, fields))
    else insert(picker.place, STEP_REQUEST, fields, request.name)
    setPicker(null)
  }

  const remove = useCallback((id) => {
    const entry = context.index.get(id)
    if (!entry) return
    store().showConfirm(FLOW_CANVAS_TEXT.removeTitle, FLOW_CANVAS_TEXT.removeMessage(stepTitle(entry.step, catalog)), () => {
      change(removeStep(store().tabs.find((candidate) => candidate.id === tab.id).flowDraft, id))
      setSelected((current) => (current === id ? "" : current))
    }, null, "destructive", FLOW_CANVAS_TEXT.remove)
  }, [catalog, change, context.index, tab.id])

  const move = useCallback((id, offset) => {
    change(moveStep(flow, id, offset))
    focusNode(id)
  }, [change, flow])

  const duplicate = (id) => {
    const copied = duplicateStep(flow, id)
    change(copied.flow)
    select(copied.id)
  }

  const rename = (from, wanted) => {
    const renamed = renameStep(flow, from, wanted)
    change(renamed.flow)
    setSelected(renamed.id)
  }

  const handleKeyDown = (event) => {
    if (!(event.ctrlKey || event.metaKey) || isEditingText(event.target)) return
    const key = event.key.toLowerCase()
    const wantsRedo = key === REDO_KEY || (key === UNDO_KEY && event.shiftKey)
    if (key !== UNDO_KEY && key !== REDO_KEY) return
    event.preventDefault()
    travel(wantsRedo ? redoChange : undoChange)
  }

  return (
    <div data-pane="request" onKeyDown={handleKeyDown} className="flex min-h-0 flex-1 flex-col">
      <FlowToolbar
        flow={flow}
        isDirty={isDirty}
        isRunning={isRunning}
        history={{ canUndo: canUndo(tab.id), canRedo: canRedo(tab.id) }}
        onRename={(name) => change({ ...flow, name }, "name")}
        onSave={() => actions.save(tab.id)}
        onRun={() => actions.run(tab.id)}
        onStop={() => actions.stop(tab.id)}
        onUndo={() => travel(undoChange)}
        onRedo={() => travel(redoChange)}
      />
      <div className={SPLIT_PANES}>
        <div dir="ltr" className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/20 max-sm:max-h-[55%]">
          <FlowCanvas
            flow={flow}
            context={context}
            nodes={run?.nodes || {}}
            problems={problemsByStep}
            selected={selected}
            onSelect={select}
            onOpen={open}
            onInsert={chooseKind}
            onRemove={remove}
            onMove={move}
          />
        </div>
        <ResizablePane as="aside" pane={FLOW_PANE} edge={EDGE_START} aria-label={TEXT.panelLabel} className={cn(PANE_WIDTH, "flex min-h-0 shrink-0 flex-col border-border max-sm:min-h-0 max-sm:flex-1 max-sm:border-t sm:border-s")}>
          <Tabs value={panel} onValueChange={setPanel} className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
              <TabsList label={TEXT.panelLabel}>
                <TabsTrigger value={PANEL_STEP}>{TEXT.stepTab}</TabsTrigger>
                <TabsTrigger value={PANEL_RUN}>{TEXT.runTab}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value={PANEL_STEP} className={cn("flex min-h-0 flex-1 flex-col")}>
              {selectedStep ? (
                <StepEditor
                  key={selectedStep.id}
                  step={selectedStep}
                  index={context.index}
                  requests={catalog}
                  problems={problemsByStep.get(selectedStep.id) || []}
                  onPatch={(patch) => change(updateStep(flow, selectedStep.id, patch), `${selectedStep.id}:${Object.keys(patch).join()}`)}
                  onRename={(wanted) => rename(selectedStep.id, wanted)}
                  onMove={(offset) => move(selectedStep.id, offset)}
                  onDuplicate={() => duplicate(selectedStep.id)}
                  onRemove={() => remove(selectedStep.id)}
                  onPickRequest={() => setPicker({ stepId: selectedStep.id })}
                  EditorComponent={EditorComponent}
                />
              ) : (
                <FlowSettings flow={flow} problems={problems} index={context.index} requests={catalog} onChange={change} onSelectStep={setSelected} />
              )}
            </TabsContent>
            <TabsContent value={PANEL_RUN} className="flex min-h-0 flex-1 flex-col">
              <FlowRunPanel run={run} canRun={flow.steps.length > 0} onRun={() => actions.run(tab.id)} onReport={() => actions.downloadReport(tab.id)} onSelectStep={select} />
            </TabsContent>
          </Tabs>
        </ResizablePane>
      </div>
      {picker && <RequestPicker catalog={catalog} onChoose={chooseRequest} onClose={() => setPicker(null)} />}
    </div>
  )
}
