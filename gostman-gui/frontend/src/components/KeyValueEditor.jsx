import { X } from "lucide-react"
import { IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { VariableInput } from "./VariableInput"
import { PanelBody, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { FileField } from "./FileField"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { ROW_FILE, ROW_TEXT, isBlankRow, isFileRow } from "../lib/rows"
import { cn } from "../lib/utils"

const PLAIN_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"
const TYPED_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_5rem_minmax(0,1.5fr)_1.75rem]"

export const ROW_GRID = "grid items-center gap-x-2"
export const ROW_STACK = "flex flex-col gap-1"

const draftRow = (typed) => ({ key: "", value: "", enabled: true, ...(typed && { type: ROW_TEXT }) })

const asTextRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_TEXT })
const asFileRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_FILE, ...EMPTY_ATTACHMENT })

function ColumnLabels({ columns, typed, keyLabel, valueLabel }) {
  return (
    <div className={cn(ROW_GRID, "h-6", columns)}>
      <span />
      <SectionLabel>{keyLabel}</SectionLabel>
      {typed && <SectionLabel>Type</SectionLabel>}
      <SectionLabel>{valueLabel}</SectionLabel>
      <span />
    </div>
  )
}

function ValueCell({ row, label, onChange }) {
  if (isFileRow(row)) {
    return <FileField fileName={row.fileName} data={row.data} onChange={onChange} />
  }
  return (
    <VariableInput
      value={row.value}
      title={row.value}
      placeholder={label}
      aria-label={label}
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      className="font-mono"
    />
  )
}

function Row({ row, columns, typed, isDraft, keyLabel, valueLabel, onChange, onReplace, onRemove }) {
  return (
    <div className={cn(ROW_GRID, columns, !row.enabled && "opacity-50")}>
      <Checkbox
        label="Send this row"
        checked={row.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        className={cn(isDraft && "invisible")}
      />
      <VariableInput
        value={row.key}
        title={row.key}
        placeholder={keyLabel}
        aria-label={keyLabel}
        spellCheck={false}
        onChange={(event) => onChange({ key: event.target.value })}
        className="font-mono"
      />
      {typed && (
        <Select
          value={row.type || ROW_TEXT}
          onChange={(event) => onReplace(event.target.value === ROW_FILE ? asFileRow(row) : asTextRow(row))}
          aria-label="Field type"
        >
          <option value={ROW_TEXT}>Text</option>
          <option value={ROW_FILE}>File</option>
        </Select>
      )}
      <ValueCell row={row} label={valueLabel} onChange={onChange} />
      <IconButton label="Remove row" icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
    </div>
  )
}

export function KeyValueEditor({ rows, onChange, keyLabel = "Key", valueLabel = "Value", typed = false }) {
  const columns = typed ? TYPED_COLUMNS : PLAIN_COLUMNS
  const shown = [...rows, draftRow(typed)]

  const commit = (next) => onChange(next.filter((row) => !isBlankRow(row)))
  const replaceRow = (index, replacement) => commit(shown.map((row, at) => (at === index ? replacement : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <PanelBody>
      <ColumnLabels columns={columns} typed={typed} keyLabel={keyLabel} valueLabel={valueLabel} />
      <div className={ROW_STACK}>
        {shown.map((row, index) => (
          <Row
            key={index}
            row={row}
            columns={columns}
            typed={typed}
            isDraft={index === rows.length}
            keyLabel={keyLabel}
            valueLabel={valueLabel}
            onChange={(patch) => replaceRow(index, { ...row, ...patch })}
            onReplace={(replacement) => replaceRow(index, replacement)}
            onRemove={() => removeRow(index)}
          />
        ))}
      </div>
    </PanelBody>
  )
}
