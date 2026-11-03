import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { VariableInput } from "../VariableInput"
import { FLOW_EDITOR_TEXT as TEXT } from "../../lib/flowsText"
import { SOURCE_BODY, SOURCE_HEADER, SOURCE_STATUS, STEP_REQUEST } from "../../lib/flows/model"
import { stepTitle } from "../../lib/flows/validate"

const SOURCE_TEMPLATE = "template"
const VALUE_SOURCES = [SOURCE_TEMPLATE, SOURCE_BODY, SOURCE_HEADER, SOURCE_STATUS]
const SOURCE_KEYS = ["value", "step", "source", "path"]

const valueSource = (value) => (value.step || value.source ? value.source || SOURCE_BODY : SOURCE_TEMPLATE)

const ownFields = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !SOURCE_KEYS.includes(key)))

function withSource(value, source) {
  if (source === SOURCE_TEMPLATE) return { ...ownFields(value), value: value.value || "" }
  return { ...ownFields(value), step: value.step || "", source, path: source === SOURCE_STATUS ? "" : value.path || "" }
}

export function RequestSteps({ value, emptyLabel, index, requests, onChange, label }) {
  const steps = [...index.values()].filter(({ step }) => step.kind === STEP_REQUEST).map(({ step }) => step)
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="">{emptyLabel}</option>
      {steps.map((step) => <option key={step.id} value={step.id}>{stepTitle(step, requests)}</option>)}
    </Select>
  )
}

export function SourceSelect({ value, onChange }) {
  return (
    <Select value={valueSource(value)} onChange={(event) => onChange(withSource(value, event.target.value))} aria-label={TEXT.valueSource}>
      {VALUE_SOURCES.map((option) => <option key={option} value={option}>{TEXT.valueSources[option]}</option>)}
    </Select>
  )
}

export function SourceValue({ value, index, requests, onChange }) {
  const source = valueSource(value)
  if (source === SOURCE_TEMPLATE) {
    return <VariableInput value={value.value || ""} placeholder={TEXT.templatePlaceholder} aria-label={TEXT.templatePlaceholder} spellCheck={false} onChange={(event) => onChange({ ...value, value: event.target.value })} className="font-mono" />
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <RequestSteps value={value.step || ""} emptyLabel={TEXT.chooseStep} index={index} requests={requests} label={TEXT.fromStep} onChange={(step) => onChange({ ...value, step })} />
      {source !== SOURCE_STATUS && (
        <Input
          value={value.path || ""}
          placeholder={source === SOURCE_HEADER ? TEXT.headerPlaceholder : TEXT.pathPlaceholder}
          aria-label={source === SOURCE_HEADER ? TEXT.headerName : TEXT.jsonPath}
          spellCheck={false}
          onChange={(event) => onChange({ ...value, path: event.target.value })}
          className="font-mono"
        />
      )}
    </div>
  )
}
