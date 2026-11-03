import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { VariableInput, VariableTextarea } from "./VariableInput"
import { BOOLEAN_FALSE, BOOLEAN_TRUE, TYPE_BOOLEAN, TYPE_ENUM, TYPE_INTEGER, TYPE_JSON, TYPE_NUMBER, choicesOf, typeOf } from "../lib/requestVariables"
import { VARIABLES_PANEL_TEXT as TEXT } from "../lib/variablesPanelText"

const JSON_ROWS = 4
const isTrue = (row) => String(row.value ?? "").trim().toLowerCase() === BOOLEAN_TRUE

export function VariableValueField({ row, label, placeholder, multiline = false, onChange, ...props }) {
  const type = typeOf(row)
  const choices = choicesOf(row)

  if (type === TYPE_BOOLEAN) {
    return (
      <Checkbox
        checked={isTrue(row)}
        onChange={(event) => onChange({ value: event.target.checked ? BOOLEAN_TRUE : BOOLEAN_FALSE })}
        className="h-7 justify-start"
        {...props}
      >
        {label}
      </Checkbox>
    )
  }

  if (type === TYPE_ENUM && choices.length > 0) {
    return (
      <Select value={row.value ?? ""} onChange={(event) => onChange({ value: event.target.value })} aria-label={label} {...props}>
        <option value="">{placeholder || TEXT.valueChoice}</option>
        {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </Select>
    )
  }

  if (type === TYPE_NUMBER || type === TYPE_INTEGER) {
    return (
      <Input
        type="number"
        step={type === TYPE_INTEGER ? 1 : "any"}
        value={row.value ?? ""}
        placeholder={placeholder || label}
        aria-label={label}
        onChange={(event) => onChange({ value: event.target.value })}
        dir="ltr"
        className="font-mono"
        {...props}
      />
    )
  }

  if (type === TYPE_JSON && multiline) {
    return (
      <VariableTextarea
        value={row.value ?? ""}
        rows={JSON_ROWS}
        placeholder={placeholder || label}
        aria-label={label}
        spellCheck={false}
        onChange={(event) => onChange({ value: event.target.value })}
        {...props}
      />
    )
  }

  return (
    <VariableInput
      value={row.value ?? ""}
      title={row.value}
      placeholder={placeholder || label}
      aria-label={label}
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      className="font-mono"
      {...props}
    />
  )
}
