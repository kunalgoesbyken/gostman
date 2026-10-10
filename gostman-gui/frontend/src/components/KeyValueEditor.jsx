import { X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { FileField } from "./FileField"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { ROW_FILE, ROW_TEXT, isBlankRow, isFileRow } from "../lib/rows"
import { cn } from "../lib/utils"

const PLAIN_COLUMNS = "grid-cols-[1rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"
const TYPED_COLUMNS = "grid-cols-[1rem_minmax(0,1fr)_5.5rem_minmax(0,1.5fr)_1.75rem]"
const CELL_INPUT = "h-8 px-2 font-mono text-xs"

const draftRow = (typed) => ({ key: "", value: "", enabled: true, ...(typed && { type: ROW_TEXT }) })

const asTextRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_TEXT })
const asFileRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_FILE, ...EMPTY_ATTACHMENT })

function ColumnLabels({ columns, typed, keyLabel, valueLabel }) {
  return (
    <div className={cn("grid items-center gap-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", columns)}>
      <span />
      <span>{keyLabel}</span>
      {typed && <span>Type</span>}
      <span>{valueLabel}</span>
      <span />
    </div>
  )
}

function ValueCell({ row, placeholder, onChange }) {
  if (isFileRow(row)) {
    return <FileField fileName={row.fileName} data={row.data} onChange={onChange} />
  }
  return (
    <Input
      value={row.value}
      placeholder={placeholder}
      aria-label={placeholder}
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      className={CELL_INPUT}
    />
  )
}

function Row({ row, columns, typed, isDraft, keyLabel, valueLabel, onChange, onReplace, onRemove }) {
  return (
    <div className={cn("grid items-center gap-2", columns, !row.enabled && "opacity-50")}>
      <input
        type="checkbox"
        checked={row.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        aria-label="Send this row"
        className={cn("h-3.5 w-3.5 accent-primary", isDraft && "invisible")}
      />
      <Input
        value={row.key}
        placeholder={keyLabel}
        aria-label={keyLabel}
        spellCheck={false}
        onChange={(event) => onChange({ key: event.target.value })}
        className={CELL_INPUT}
      />
      {typed && (
        <Select
          value={row.type || ROW_TEXT}
          onChange={(event) => onReplace(event.target.value === ROW_FILE ? asFileRow(row) : asTextRow(row))}
          aria-label="Field type"
          className="h-8 px-2 text-xs"
        >
          <option value={ROW_TEXT}>Text</option>
          <option value={ROW_FILE}>File</option>
        </Select>
      )}
      <ValueCell row={row} placeholder={valueLabel} onChange={onChange} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove row"
        className={cn("h-7 w-7 text-muted-foreground hover:text-destructive", isDraft && "invisible")}
      >
        <X />
      </Button>
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
    <div className="h-full overflow-auto px-4 py-3 scrollbar-primary">
      <ColumnLabels columns={columns} typed={typed} keyLabel={keyLabel} valueLabel={valueLabel} />
      <div className="flex flex-col gap-1">
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
    </div>
  )
}
