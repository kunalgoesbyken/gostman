import { Checkbox } from "./ui/checkbox"
import { Select } from "./ui/select"
import { VariableInput, VariableTextarea } from "./VariableInput"
import { BOOLEAN_FALSE, BOOLEAN_TRUE, TYPE_JSON, choicesOf, typeOf, usesCheckbox, usesChoiceList } from "../lib/requestVariables"
import { VARIABLES_PANEL_TEXT as TEXT } from "../lib/variablesPanelText"

const JSON_ROWS = 4
const isTrue = (row) => row.value === BOOLEAN_TRUE

export function VariableValueField({ row, label, placeholder, multiline = false, onChange, ...props }) {
  const type = typeOf(row)
  const choices = choicesOf(row)

  if (usesCheckbox(row)) {
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

  if (usesChoiceList(row)) {
    return (
      <Select value={String(row.value ?? "")} onChange={(event) => onChange({ value: event.target.value })} aria-label={label} {...props}>
        <option value="">{placeholder || TEXT.valueChoice}</option>
        {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </Select>
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
