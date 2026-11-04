import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Copy, ExternalLink, Plus, Trash2, Workflow, X } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { Field } from "../ui/field"
import { Input } from "../ui/input"
import { SectionLabel } from "../ui/panel"
import { SegmentedControl } from "../ui/segmented"
import { Select } from "../ui/select"
import { MarkdownField } from "../MarkdownField"
import { MethodTag } from "../MethodTag"
import { ScopeMark } from "../ScopeMark"
import { VariableInput } from "../VariableInput"
import { ChecksEditor, ConditionTree } from "./ConditionTree"
import { iconOf } from "./FlowNode"
import { PanelSection } from "./PanelSection"
import { StepInputs } from "./StepInputs"
import { RequestSteps, SourceSelect, SourceValue } from "./ValueSource"
import { FLOW_CANVAS_TEXT, FLOW_EDITOR_TEXT as TEXT } from "../../lib/flowsText"
import { blankCase } from "../../lib/flows/edit"
import { flowInputs } from "../../lib/flows/declared"
import {
  BRANCH_STATES, CONDITION_RESPONSE, CONDITION_VARIABLES, ELAPSED_FACT, END_TARGET, MAX_ATTEMPTS, MAX_DELAY_MS, MAX_PASSES, OUTCOME_FAILED,
  OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_PARALLEL, STEP_REPEAT,
  STEP_REQUEST, STEP_SET, STEP_SWITCH, isBranch, loopsAround, normalizeFlow,
} from "../../lib/flows/model"
import { SOURCE_CALL, SOURCE_LOOP, SOURCE_SEND } from "../../lib/flows/outputs"
import { caseLabel, kindText, resolveFlow, resolveRequest, stepTitle } from "../../lib/flows/validate"
import { SCOPE_SESSION } from "../../lib/scripting/scopes"
import { hasActiveCondition } from "../../lib/flows/conditions"
import { cn } from "../../lib/utils"

const DEPTH_INDENT = " "

const wholeNumber = (text, lowest, highest) => Math.min(Math.max(Math.trunc(Number(text)) || 0, lowest), highest)

const Section = ({ title, id, children }) => <PanelSection id={id || title} title={title}>{children}</PanelSection>

function ScopeNote({ source, children }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
      <ScopeMark source={source} label="" />
      {children}
    </p>
  )
}

function Hint({ children }) {
  return <p className="text-2xs text-muted-foreground">{children}</p>
}

function reachableTargets(step, index, requests, flows) {
  const around = loopsAround(index, step.id)
  return [...index.values()]
    .filter(({ step: candidate }) => candidate.id !== step.id && loopsAround(index, candidate.id).every((loop) => around.includes(loop)))
    .map(({ step: candidate }) => ({ id: candidate.id, label: `${DEPTH_INDENT.repeat(loopsAround(index, candidate.id).length)}${stepTitle(candidate, requests, flows)}` }))
}

function TargetSelect({ label, value, emptyLabel, step, index, requests, flows, onChange }) {
  const targets = reachableTargets(step, index, requests, flows)
  const isKnown = value === "" || value === END_TARGET || targets.some((target) => target.id === value)
  return (
    <Field label={label}>
      <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        <option value="">{emptyLabel}</option>
        {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
        <option value={END_TARGET}>{TEXT.endOfFlow}</option>
        {!isKnown && <option value={value}>{TEXT.missingTarget(value)}</option>}
      </Select>
    </Field>
  )
}

function NumberInput({ value, lowest, highest, label, onChange }) {
  return (
    <Input
      type="number"
      min={lowest}
      max={highest}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(wholeNumber(event.target.value, lowest, highest))}
      className="w-28 font-mono"
    />
  )
}

function VariableRows({ variables, onChange }) {
  const rows = [...Object.entries(variables), ["", ""]]
  const commit = (next) => onChange(Object.fromEntries(next.filter(([name]) => name.trim() !== "")))
  const patch = (position, entry) => commit(rows.map((row, at) => (at === position ? entry : row)))
  return (
    <div className="flex flex-col gap-1">
      {rows.map(([name, value], position) => (
        <div key={position} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_1.75rem] items-center gap-2">
          <Input value={name} placeholder={TEXT.variableName} aria-label={TEXT.variableName} spellCheck={false} onChange={(event) => patch(position, [event.target.value, value])} className="font-mono" />
          <VariableInput value={value} placeholder={TEXT.variableValue} aria-label={TEXT.variableValue} spellCheck={false} onChange={(event) => patch(position, [name, event.target.value])} className="font-mono" />
          <IconButton label={TEXT.removeRow} icon={X} onClick={() => commit(rows.filter((_, at) => at !== position))} className={cn(position === rows.length - 1 && "invisible")} />
        </div>
      ))}
    </div>
  )
}

function ValueRow({ value, isDraft, index, requests, onChange, onRemove }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem_1.75rem] items-center gap-2">
        <Input value={value.name} placeholder={TEXT.variableName} aria-label={TEXT.variableName} spellCheck={false} onChange={(event) => onChange({ ...value, name: event.target.value })} className="font-mono" />
        <SourceSelect value={value} onChange={onChange} />
        <IconButton label={TEXT.removeRow} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
      </div>
      <SourceValue value={value} index={index} requests={requests} onChange={onChange} />
    </div>
  )
}

const BLANK_VALUE = { name: "", value: "" }

export function ValueRows({ values, index, requests, onChange }) {
  const rows = [...values, BLANK_VALUE]
  const commit = (next) => onChange(next.filter((value) => value.name.trim() !== "" || value.step || value.value || value.source))
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((value, position) => (
        <ValueRow
          key={position}
          value={value}
          isDraft={position === values.length}
          index={index}
          requests={requests}
          onChange={(next) => commit(rows.map((row, at) => (at === position ? next : row)))}
          onRemove={() => commit(rows.filter((_, at) => at !== position))}
        />
      ))}
    </div>
  )
}

function RequestFields({ step, index, requests, onPatch, onPickRequest, EditorComponent, targets, inBranch }) {
  const request = resolveRequest(step, requests)
  return (
    <>
      <Section title={TEXT.request}>
        <Button variant="outline" onClick={onPickRequest} className="h-auto min-h-8 w-full justify-start py-1.5">
          {request ? <MethodTag method={request.method} className="w-12" /> : null}
          <span className={cn("min-w-0 truncate", !request && "text-muted-foreground")}>{request ? request.path : step.request || FLOW_CANVAS_TEXT.chooseRequest}</span>
        </Button>
        <SectionLabel className="pt-1">{TEXT.inputs}</SectionLabel>
        <ScopeNote source={SOURCE_SEND}>{TEXT.sendScope}</ScopeNote>
        <StepInputs variables={step.variables} inputs={step.inputs || []} index={index} requests={requests} onChange={onPatch} />
      </Section>
      {inBranch ? <BranchNote /> : (
        <>
          <Section title={TEXT.retry}>
        <Field label={TEXT.attempts}>
          <NumberInput value={step.retry.times} lowest={1} highest={MAX_ATTEMPTS} label={TEXT.attempts} onChange={(times) => onPatch({ retry: { ...step.retry, times } })} />
        </Field>
        <Field label={TEXT.retryDelay}>
          <NumberInput value={step.retry.delayMs} lowest={0} highest={MAX_DELAY_MS} label={TEXT.retryDelay} onChange={(delayMs) => onPatch({ retry: { ...step.retry, delayMs } })} />
        </Field>
        <SectionLabel className="pt-1">{TEXT.until}</SectionLabel>
        <ChecksEditor conditions={step.retry.until} onChange={(until) => onPatch({ retry: { ...step.retry, until } })} EditorComponent={EditorComponent} />
        <Hint>{TEXT.untilHint}</Hint>
          </Section>
          <Section title={TEXT.paths}>
            {targets("next", TEXT.whenPassed, TEXT.nextStep)}
            {targets("onFailure", TEXT.whenFailed, TEXT.failFlow)}
          </Section>
        </>
      )}
    </>
  )
}

function BranchNote() {
  return (
    <Section title={TEXT.paths}>
      <Hint>{TEXT.branchNote}</Hint>
    </Section>
  )
}

function ConditionSource({ step, index, requests, onPatch }) {
  const sources = [CONDITION_RESPONSE, CONDITION_VARIABLES].map((value) => ({ value, label: TEXT.conditionSources[value] }))
  return (
    <>
      <SegmentedControl label={TEXT.check} options={sources} value={step.source} onChange={(source) => onPatch({ source })} />
      {step.source === CONDITION_RESPONSE && (
        <Field label={TEXT.responseOf}>
          <RequestSteps value={step.step} emptyLabel={TEXT.latestResponse} index={index} requests={requests} label={TEXT.responseOf} onChange={(value) => onPatch({ step: value })} />
        </Field>
      )}
    </>
  )
}

const ConditionHint = ({ source }) => <Hint>{source === CONDITION_VARIABLES ? TEXT.variablesConditionHint : TEXT.responseConditionHint}</Hint>

function IfFields({ step, index, requests, onPatch, EditorComponent, targets }) {
  return (
    <>
      <Section title={TEXT.check}>
        <ConditionSource step={step} index={index} requests={requests} onPatch={onPatch} />
        <ConditionTree match={step.match} conditions={step.conditions} onChange={onPatch} EditorComponent={EditorComponent} />
        <ConditionHint source={step.source} />
      </Section>
      <Section title={TEXT.paths}>
        {targets("then", TEXT.whenTrue, TEXT.nextStep)}
        {targets("else", TEXT.whenFalse, TEXT.nextStep)}
      </Section>
    </>
  )
}

const moved = (list, from, to) => {
  const kept = list.filter((_, position) => position !== from)
  return [...kept.slice(0, to), list[from], ...kept.slice(to)]
}

function CaseCard({ step, kase, position, count, index, requests, flows, EditorComponent, onChange, onMove, onRemove }) {
  const title = caseLabel(kase, position)
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1">
        <Input value={kase.label} placeholder={title} aria-label={TEXT.caseLabel} onChange={(event) => onChange({ ...kase, label: event.target.value })} className="min-w-0 flex-1" />
        <IconButton label={TEXT.moveCaseUp} icon={ArrowUp} disabled={position === 0} onClick={() => onMove(position - 1)} />
        <IconButton label={TEXT.moveCaseDown} icon={ArrowDown} disabled={position === count - 1} onClick={() => onMove(position + 1)} />
        <IconButton label={TEXT.removeCase} icon={X} onClick={onRemove} />
      </div>
      <ConditionTree match={kase.match} conditions={kase.conditions} onChange={(tree) => onChange({ ...kase, ...tree })} EditorComponent={EditorComponent} />
      <TargetSelect label={TEXT.whenMatched} value={kase.target} emptyLabel={TEXT.nextStep} step={step} index={index} requests={requests} flows={flows} onChange={(target) => onChange({ ...kase, target })} />
    </div>
  )
}

function SwitchFields({ step, index, requests, flows, onPatch, EditorComponent, targets }) {
  const setCases = (cases) => onPatch({ cases })
  return (
    <>
      <Section title={TEXT.check}>
        <ConditionSource step={step} index={index} requests={requests} onPatch={onPatch} />
        <ConditionHint source={step.source} />
      </Section>
      <Section title={TEXT.cases}>
        {step.cases.map((kase, position) => (
          <CaseCard
            key={position}
            step={step}
            kase={kase}
            position={position}
            count={step.cases.length}
            index={index}
            requests={requests}
            flows={flows}
            EditorComponent={EditorComponent}
            onChange={(next) => setCases(step.cases.map((current, at) => (at === position ? next : current)))}
            onMove={(to) => setCases(moved(step.cases, position, to))}
            onRemove={() => setCases(step.cases.filter((_, at) => at !== position))}
          />
        ))}
        <Button variant="outline" size="sm" onClick={() => setCases([...step.cases, blankCase()])} className="self-start">
          <Plus />
          {TEXT.addCase}
        </Button>
        <Hint>{TEXT.casesHint}</Hint>
      </Section>
      <Section title={TEXT.paths}>{targets("else", TEXT.whenNoCase, TEXT.nextStep)}</Section>
    </>
  )
}

function RepeatFields({ step, index, requests, onPatch, EditorComponent, targets }) {
  const hasUntil = hasActiveCondition(step.until)
  return (
    <>
      <Section title={TEXT.passes}>
        <Field label={TEXT.passes}>
          <NumberInput value={step.times} lowest={1} highest={MAX_PASSES} label={TEXT.passes} onChange={(times) => onPatch({ times })} />
        </Field>
        <Field label={TEXT.passDelay}>
          <NumberInput value={step.delayMs} lowest={0} highest={MAX_DELAY_MS} label={TEXT.passDelay} onChange={(delayMs) => onPatch({ delayMs })} />
        </Field>
        <Field label={TEXT.passName}>
          <Input value={step.indexAs} spellCheck={false} onChange={(event) => onPatch({ indexAs: event.target.value })} className="font-mono" />
        </Field>
        <ScopeNote source={SOURCE_LOOP}>{TEXT.loopScope}</ScopeNote>
        <Hint>{TEXT.repeatHint(step.indexAs || "index")}</Hint>
      </Section>
      <Section title={TEXT.until}>
        <ConditionSource step={step} index={index} requests={requests} onPatch={onPatch} />
        <ConditionTree match={step.match} conditions={step.until} onChange={({ match, conditions }) => onPatch({ match, until: conditions })} EditorComponent={EditorComponent} />
        <Hint>{TEXT.repeatUntilHint}</Hint>
      </Section>
      <Section title={TEXT.paths}>
        {targets("next", TEXT.afterRepeat, TEXT.nextStep)}
        {hasUntil && targets("onFailure", TEXT.whenNeverMet, TEXT.failFlow)}
      </Section>
    </>
  )
}

function InputRows({ inputs, variables, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      {inputs.map((input) => (
        <div key={input.name} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-2">
          <span className="flex min-w-0 items-center gap-1 font-mono text-xs">
            <span className="truncate" title={input.name}>{input.name}</span>
            <span className="shrink-0 font-sans text-2xs text-muted-foreground">{TEXT.typeLabels[input.type]}</span>
            {input.required && <span className="shrink-0 font-sans text-2xs text-warning">{TEXT.required}</span>}
          </span>
          <VariableInput
            value={variables[input.name] ?? ""}
            placeholder={input.required ? TEXT.requiredPlaceholder : input.value || TEXT.defaultPlaceholder}
            aria-label={input.name}
            spellCheck={false}
            onChange={(event) => onChange(input.name, event.target.value)}
            className="font-mono"
          />
        </div>
      ))}
    </div>
  )
}

function withoutKey(values, name) {
  const kept = { ...values }
  delete kept[name]
  return kept
}

function CalledFlowDetails({ called, step, onPatch }) {
  const shape = normalizeFlow(called)
  const inputs = flowInputs(shape)
  const outputs = shape.outputs.filter((output) => output.name !== "")
  const inputNames = new Set(inputs.map((input) => input.name))
  const others = Object.fromEntries(Object.entries(step.variables).filter(([name]) => !inputNames.has(name)))
  const setInput = (name, value) => onPatch({ variables: value === "" ? withoutKey(step.variables, name) : { ...step.variables, [name]: value } })
  const setOthers = (next) => onPatch({ variables: { ...Object.fromEntries(Object.entries(step.variables).filter(([name]) => inputNames.has(name))), ...next } })
  return (
    <>
      {inputs.length > 0 && (
        <>
          <SectionLabel className="pt-1">{TEXT.flowInputs}</SectionLabel>
          <InputRows inputs={inputs} variables={step.variables} onChange={setInput} />
        </>
      )}
      <SectionLabel className="pt-1">{inputs.length > 0 ? TEXT.otherVariables : TEXT.flowVariables}</SectionLabel>
      <ScopeNote source={SOURCE_CALL}>{TEXT.flowScope}</ScopeNote>
      <VariableRows variables={others} onChange={setOthers} />
      <Hint>{TEXT.flowVariablesHint}</Hint>
      {outputs.length > 0 && <Hint>{TEXT.givesBack(outputs.map((output) => output.name))}</Hint>}
    </>
  )
}

function FlowFields({ step, flows, onPatch, onPickFlow, onOpenFlow, targets, inBranch }) {
  const called = resolveFlow(step, flows)
  return (
    <>
      <Section title={TEXT.flow}>
        <Button variant="outline" onClick={onPickFlow} className="h-auto min-h-8 w-full justify-start py-1.5">
          <Workflow aria-hidden="true" className="text-muted-foreground" />
          <span className={cn("min-w-0 truncate", !called && "text-muted-foreground")}>{called ? called.name : step.flow || FLOW_CANVAS_TEXT.noFlow}</span>
        </Button>
        <Button variant="ghost" size="sm" disabled={!called} onClick={() => onOpenFlow(called.id)} className="self-start">
          <ExternalLink />
          {TEXT.openFlow}
        </Button>
        {called ? <CalledFlowDetails called={called} step={step} onPatch={onPatch} /> : (
          <>
            <SectionLabel className="pt-1">{TEXT.flowVariables}</SectionLabel>
            <ScopeNote source={SOURCE_CALL}>{TEXT.flowScope}</ScopeNote>
            <VariableRows variables={step.variables} onChange={(variables) => onPatch({ variables })} />
          </>
        )}
      </Section>
      {inBranch ? <BranchNote /> : (
        <Section title={TEXT.paths}>
          {targets("next", TEXT.whenPassed, TEXT.nextStep)}
          {targets("onFailure", TEXT.whenFailed, TEXT.failFlow)}
        </Section>
      )}
    </>
  )
}

function FactNames({ step }) {
  const names = [...step.steps.flatMap((branch) => [branch.id, `${branch.id}.status`, `${branch.id}.ms`]), ELAPSED_FACT]
  return (
    <div className="flex flex-col gap-1 text-2xs text-muted-foreground">
      <span>{TEXT.factsHint(BRANCH_STATES.map((state) => TEXT.branchStateWords[state]))}</span>
      <span className="flex flex-wrap gap-1">
        {names.map((name) => <code key={name} className="rounded border border-border bg-muted/40 px-1 font-mono text-foreground">{name}</code>)}
      </span>
    </div>
  )
}

function ParallelFields({ step, onPatch, EditorComponent, targets }) {
  const hasUntil = hasActiveCondition(step.until)
  return (
    <>
      <Section title={TEXT.branches}>
        <Hint>{TEXT.branchesHint(step.steps.length)}</Hint>
        <Field label={TEXT.timeout}>
          <NumberInput value={step.timeoutMs} lowest={0} highest={MAX_DELAY_MS} label={TEXT.timeout} onChange={(timeoutMs) => onPatch({ timeoutMs })} />
        </Field>
        <Hint>{TEXT.timeoutHint}</Hint>
      </Section>
      <Section title={TEXT.doneWhen}>
        <ConditionTree match={step.match} conditions={step.until} onChange={({ match, conditions }) => onPatch({ match, until: conditions })} EditorComponent={EditorComponent} />
        {!hasUntil && <Hint>{TEXT.doneWhenEmpty}</Hint>}
        <FactNames step={step} />
      </Section>
      <Section title={TEXT.paths}>
        {targets("next", TEXT.whenPassed, TEXT.nextStep)}
        {targets("onFailure", TEXT.whenParallelFails, TEXT.failFlow)}
      </Section>
    </>
  )
}

function ForEachFields({ step, index, requests, onPatch, targets }) {
  return (
    <>
      <Section title={TEXT.list}>
        <Field label={TEXT.responseOf}>
          <RequestSteps value={step.step} emptyLabel={TEXT.chooseStep} index={index} requests={requests} label={TEXT.responseOf} onChange={(value) => onPatch({ step: value })} />
        </Field>
        <Field label={TEXT.jsonPath}>
          <Input value={step.path} placeholder="$.items" spellCheck={false} onChange={(event) => onPatch({ path: event.target.value })} className="font-mono" />
        </Field>
        <Field label={TEXT.itemName}>
          <Input value={step.as} spellCheck={false} onChange={(event) => onPatch({ as: event.target.value })} className="font-mono" />
        </Field>
        <Field label={TEXT.indexName}>
          <Input value={step.indexAs} spellCheck={false} onChange={(event) => onPatch({ indexAs: event.target.value })} className="font-mono" />
        </Field>
        <ScopeNote source={SOURCE_LOOP}>{TEXT.loopScope}</ScopeNote>
        <Hint>{TEXT.loopHint(step.as || "item", step.indexAs || "index")}</Hint>
      </Section>
      <Section title={TEXT.paths}>{targets("next", TEXT.afterLoop, TEXT.nextStep)}</Section>
    </>
  )
}

function SetFields({ step, index, requests, onPatch, targets }) {
  return (
    <>
      <Section title={TEXT.values}>
        <ScopeNote source={SCOPE_SESSION}>{TEXT.sessionScope}</ScopeNote>
        <ValueRows values={step.values} index={index} requests={requests} onChange={(values) => onPatch({ values })} />
        <Hint>{TEXT.valuesHint}</Hint>
      </Section>
      <Section title={TEXT.paths}>{targets("next", TEXT.whenPassed, TEXT.nextStep)}</Section>
    </>
  )
}

function DelayFields({ step, onPatch, targets }) {
  return (
    <>
      <Section title={TEXT.wait}>
        <Field label={TEXT.milliseconds}>
          <NumberInput value={step.ms} lowest={0} highest={MAX_DELAY_MS} label={TEXT.milliseconds} onChange={(ms) => onPatch({ ms })} />
        </Field>
      </Section>
      <Section title={TEXT.paths}>{targets("next", TEXT.whenPassed, TEXT.nextStep)}</Section>
    </>
  )
}

function EndFields({ step, onPatch }) {
  const outcomes = [OUTCOME_PASSED, OUTCOME_FAILED].map((value) => ({ value, label: TEXT.outcomes[value] }))
  return (
    <Section title={TEXT.outcome}>
      <SegmentedControl label={TEXT.outcome} options={outcomes} value={step.outcome} onChange={(outcome) => onPatch({ outcome })} />
      <Field label={TEXT.message}>
        <Input value={step.message} placeholder={TEXT.messagePlaceholder} onChange={(event) => onPatch({ message: event.target.value })} />
      </Field>
    </Section>
  )
}

const KIND_FIELDS = {
  [STEP_REQUEST]: RequestFields,
  [STEP_SET]: SetFields,
  [STEP_IF]: IfFields,
  [STEP_SWITCH]: SwitchFields,
  [STEP_FOR_EACH]: ForEachFields,
  [STEP_REPEAT]: RepeatFields,
  [STEP_FLOW]: FlowFields,
  [STEP_PARALLEL]: ParallelFields,
  [STEP_DELAY]: DelayFields,
  [STEP_END]: EndFields,
}

function StepIdField({ id, onRename }) {
  const [draft, setDraft] = useState(id)
  useEffect(() => setDraft(id), [id])
  const commit = () => {
    if (draft.trim() && draft !== id) onRename(draft)
    else setDraft(id)
  }
  return (
    <Field label={TEXT.stepId}>
      <Input
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
        className="font-mono"
      />
    </Field>
  )
}

export function StepEditor({ step, index, requests, flows, problems, onPatch, onRename, onMove, onDuplicate, onRemove, onPickRequest, onPickFlow, onOpenFlow, EditorComponent }) {
  const Icon = iconOf(step.kind)
  const Fields = KIND_FIELDS[step.kind]
  const targets = (field, label, emptyLabel) => (
    <TargetSelect label={label} value={step[field] || ""} emptyLabel={emptyLabel} step={step} index={index} requests={requests} flows={flows} onChange={(value) => onPatch({ [field]: value })} />
  )
  return (
    <div data-flow-editor className="flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-wrap:anywhere]">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{kindText(step.kind).label}</span>
        <IconButton label={FLOW_CANVAS_TEXT.moveUp} icon={ArrowUp} onClick={() => onMove(-1)} />
        <IconButton label={FLOW_CANVAS_TEXT.moveDown} icon={ArrowDown} onClick={() => onMove(1)} />
        <IconButton label={FLOW_CANVAS_TEXT.duplicate} icon={Copy} onClick={onDuplicate} />
        <IconButton label={FLOW_CANVAS_TEXT.remove} icon={Trash2} onClick={onRemove} className="hover:text-destructive" />
      </div>
      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 border-b border-border bg-warning/10 px-3 py-2 text-xs text-warning">
          {problems.map((problem, position) => <li key={position}>{problem}</li>)}
        </ul>
      )}
      <Section>
        <Field label={TEXT.label}>
          <Input value={step.label} placeholder={stepTitle({ ...step, label: "" }, requests, flows)} onChange={(event) => onPatch({ label: event.target.value })} />
        </Field>
        <StepIdField id={step.id} onRename={onRename} />
        <SectionLabel className="pt-1">{TEXT.note}</SectionLabel>
        <MarkdownField value={step.note} onChange={(note) => onPatch({ note })} placeholder={TEXT.notePlaceholder} rows={3} label={TEXT.note} />
      </Section>
      {Fields && (
        <Fields
          step={step}
          index={index}
          requests={requests}
          flows={flows}
          onPatch={onPatch}
          onPickRequest={onPickRequest}
          onPickFlow={onPickFlow}
          onOpenFlow={onOpenFlow}
          EditorComponent={EditorComponent}
          targets={targets}
          inBranch={isBranch(index, step.id)}
        />
      )}
    </div>
  )
}
