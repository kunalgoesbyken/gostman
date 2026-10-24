import { useId, useState } from "react"
import { X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { VariableInput } from "./VariableInput"
import { PanelBody, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { FileField } from "./FileField"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { ROW_FILE, ROW_TEXT, isBlankRow, isFileRow } from "../lib/rows"
import { bulkTextToRows, fitsBulkText, rowsToBulkText } from "../lib/bulkRows"
import { cn } from "../lib/utils"

const PLAIN_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"
const TYPED_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_5rem_minmax(0,1.5fr)_1.75rem]"

export const ROW_GRID = "grid items-center gap-x-2"
export const ROW_STACK = "flex flex-col gap-1"

const MIN_BULK_LINES = 6
const BULK_HINT = "One row per line as name: value. Start a line with // to keep it without sending it."
const BULK_UNAVAILABLE = "Rows with a colon in the name, or spaces at the start or end, can only be edited in the table."

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
    return <FileField fileName={row.fileName} data={row.data} path={row.path} onChange={onChange} />
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

function BulkEditor({ rows, keyLabel, onChange }) {
  const hintId = useId()
  const [draft, setDraft] = useState(() => rowsToBulkText(rows))
  const current = rowsToBulkText(rows)
  const text = rowsToBulkText(bulkTextToRows(draft)) === current ? draft : current

  const edit = (event) => {
    setDraft(event.target.value)
    onChange(bulkTextToRows(event.target.value))
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus
        value={text}
        onChange={edit}
        rows={Math.max(MIN_BULK_LINES, rows.length + 1)}
        aria-label={`${keyLabel} rows as text`}
        aria-describedby={hintId}
        placeholder={`${keyLabel}: value`}
      />
      <p id={hintId} className="text-2xs text-muted-foreground">{BULK_HINT}</p>
    </div>
  )
}

function TableEditor({ rows, typed, keyLabel, valueLabel, onChange }) {
  const columns = typed ? TYPED_COLUMNS : PLAIN_COLUMNS
  const shown = [...rows, draftRow(typed)]

  const commit = (next) => onChange(next.filter((row) => !isBlankRow(row)))
  const replaceRow = (index, replacement) => commit(shown.map((row, at) => (at === index ? replacement : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <>
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
    </>
  )
}

function ModeSwitch({ rows, showsBulk, onSwitch }) {
  if (showsBulk) {
    return (
      <Button variant="ghost" size="sm" onClick={() => onSwitch(false)}>
        Edit as table
      </Button>
    )
  }
  if (!fitsBulkText(rows)) return <p className="text-2xs text-muted-foreground">{BULK_UNAVAILABLE}</p>
  return (
    <Button variant="ghost" size="sm" onClick={() => onSwitch(true)}>
      Bulk edit
    </Button>
  )
}

export function KeyValueEditor({ rows, onChange, keyLabel = "Key", valueLabel = "Value", typed = false }) {
  const [isBulk, setIsBulk] = useState(false)
  const showsBulk = isBulk && !typed

  return (
    <PanelBody>
      {showsBulk ? (
        <BulkEditor rows={rows} keyLabel={keyLabel} onChange={onChange} />
      ) : (
        <TableEditor rows={rows} typed={typed} keyLabel={keyLabel} valueLabel={valueLabel} onChange={onChange} />
      )}
      {!typed && (
        <div className="mt-2 flex justify-end">
          <ModeSwitch rows={rows} showsBulk={showsBulk} onSwitch={setIsBulk} />
        </div>
      )}
    </PanelBody>
  )
}
