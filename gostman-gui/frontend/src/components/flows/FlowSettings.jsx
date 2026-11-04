import { AlertTriangle, ChevronRight, X } from "lucide-react"
import { IconButton } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Field } from "../ui/field"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Textarea } from "../ui/textarea"
import { VariableInput } from "../VariableInput"
import { PanelSection } from "./PanelSection"
import { ValueRows } from "./StepEditor"
import { FLOW_EDITOR_TEXT, FLOW_VIEW_TEXT as TEXT } from "../../lib/flowsText"
import { TYPE_STRING, VARIABLE_TYPES } from "../../lib/flows/declared"
import { MAX_SENDS_CAP, normalizeFlow } from "../../lib/flows/model"
import { stepTitle } from "../../lib/flows/validate"
import { cn } from "../../lib/utils"

const BLANK_VARIABLE = { name: "", type: TYPE_STRING, value: "" }

const isFilled = (declared) => declared.name.trim() !== "" || declared.value !== "" || declared.type !== TYPE_STRING || declared.input

const FLAG_KEYS = ["input", "required"]

function withFlags(declared, input, required) {
  const rest = Object.fromEntries(Object.entries(declared).filter(([key]) => !FLAG_KEYS.includes(key)))
  return { ...rest, ...(input && { input: true }), ...(input && required && { required: true }) }
}

function VariableRow({ declared, isDraft, onChange, onRemove }) {
  const words = FLOW_EDITOR_TEXT
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_1.75rem] items-center gap-2">
        <Input value={declared.name} placeholder={words.variableName} aria-label={words.variableName} spellCheck={false} onChange={(event) => onChange({ ...declared, name: event.target.value })} className="font-mono" />
        <Select value={declared.type} aria-label={TEXT.variableType} onChange={(event) => onChange({ ...declared, type: event.target.value })}>
          {VARIABLE_TYPES.map((type) => <option key={type} value={type}>{words.typeLabels[type]}</option>)}
        </Select>
        <IconButton label={words.removeRow} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
      </div>
      {!declared.required && (
        <VariableInput
          value={declared.value}
          placeholder={TEXT.initialPlaceholders[declared.type]}
          aria-label={TEXT.initialValue}
          spellCheck={false}
          onChange={(event) => onChange({ ...declared, value: event.target.value })}
          className="font-mono"
        />
      )}
      <div className="flex flex-wrap items-center gap-x-4">
        <Checkbox checked={Boolean(declared.input)} onChange={(event) => onChange(withFlags(declared, event.target.checked, declared.required))}>
          {TEXT.isInput}
        </Checkbox>
        {declared.input && (
          <Checkbox checked={Boolean(declared.required)} onChange={(event) => onChange(withFlags(declared, true, event.target.checked))}>
            {TEXT.isRequired}
          </Checkbox>
        )}
      </div>
    </div>
  )
}

function VariableRows({ variables, onChange }) {
  const rows = [...variables, BLANK_VARIABLE]
  const commit = (next) => onChange(next.filter(isFilled))
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((declared, position) => (
        <VariableRow
          key={position}
          declared={declared}
          isDraft={position === variables.length}
          onChange={(next) => commit(rows.map((row, at) => (at === position ? next : row)))}
          onRemove={() => commit(rows.filter((_, at) => at !== position))}
        />
      ))}
    </div>
  )
}

function Problems({ problems, index, requests, flows, onSelectStep }) {
  return (
    <section className="mx-3 my-3 flex flex-col gap-1 rounded-md border border-warning/40 p-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        {TEXT.problems(problems.length)}
      </p>
      <ul className="flex flex-col">
        {problems.map(({ step, message }, position) => (
          <li key={position}>
            <button type="button" disabled={!step} onClick={() => onSelectStep(step)} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-start text-xs text-foreground enabled:cursor-pointer enabled:hover:bg-accent enabled:hover:underline">
              <span className="min-w-0 flex-1">{step && index.get(step) ? `${stepTitle(index.get(step).step, requests, flows)}: ` : ""}{message}</span>
              {step && <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground rtl:rotate-180" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FlowSettings({ flow, problems, index, requests, flows, onChange, onSelectStep }) {
  const shape = normalizeFlow(flow)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-wrap:anywhere]">
      <p className="px-3 pt-3 text-xs text-muted-foreground">{TEXT.selectHint}</p>
      {problems.length > 0 && <Problems problems={problems} index={index} requests={requests} flows={flows} onSelectStep={onSelectStep} />}
      <PanelSection id="flow:general" title={TEXT.settingsTitle}>
        <Field label={TEXT.description}>
          <Textarea rows={3} value={flow.description} placeholder={TEXT.descriptionPlaceholder} onChange={(event) => onChange({ ...flow, description: event.target.value }, "description")} className="font-sans" />
        </Field>
        <Field label={TEXT.maxSends}>
          <Input type="number" min={1} max={MAX_SENDS_CAP} value={flow.maxSends} onChange={(event) => onChange({ ...flow, maxSends: event.target.value }, "maxSends")} className="w-28 font-mono" />
        </Field>
        <p className="text-2xs text-muted-foreground">{TEXT.maxSendsHint(MAX_SENDS_CAP)}</p>
      </PanelSection>
      <PanelSection id="flow:variables" title={TEXT.variablesTitle}>
        <p className="text-2xs text-muted-foreground">{TEXT.variablesHint}</p>
        <VariableRows variables={shape.variables} onChange={(variables) => onChange({ ...flow, variables }, "variables")} />
      </PanelSection>
      <PanelSection id="flow:outputs" title={TEXT.outputsTitle}>
        <p className="text-2xs text-muted-foreground">{TEXT.outputsHint}</p>
        <ValueRows values={shape.outputs} index={index} requests={requests} onChange={(outputs) => onChange({ ...flow, outputs }, "outputs")} />
      </PanelSection>
      <PanelSection id="flow:cli" title={TEXT.cliTitle}>
        <p className="text-2xs text-muted-foreground">{TEXT.cliHint}</p>
        <code className="select-all rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-2xs text-foreground">{TEXT.cli(flow.name)}</code>
      </PanelSection>
    </div>
  )
}
