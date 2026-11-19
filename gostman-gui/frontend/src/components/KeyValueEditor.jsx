import { memo, useCallback, useId, useRef, useState } from "react"
import { X } from "lucide-react"
import { shallow } from "zustand/shallow"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { VariableInput, VariableTextarea } from "./VariableInput"
import { PanelBody, SectionLabel } from "./ui/panel"
import { InfoTip } from "./ui/infoTip"
import { Select } from "./ui/select"
import { FileField } from "./FileField"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { ROW_FILE, ROW_TEXT, isBlankFileRow, isBlankRow, isFileRow } from "../lib/rows"
import { bulkTextToRows, fitsBulkText, rowsToBulkText } from "../lib/bulkRows"
import { KEY_VALUE_TEXT as TEXT } from "../lib/keyValueText"
import { cn } from "../lib/utils"

export const PLAIN_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem]"
const TYPED_COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_5rem_minmax(0,1.5fr)_1.75rem]"

export const ROW_GRID = "grid items-center gap-x-2"
export const ROW_STACK = "flex flex-col gap-1"
export const ROW_TOGGLE = "justify-start"

const MIN_BULK_LINES = 6

const draftRow = (typed, fileRows) => (fileRows ? asFileRow({ key: "", enabled: true }) : { key: "", value: "", enabled: true, ...(typed && { type: ROW_TEXT }) })

const asTextRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_TEXT })
const asFileRow = ({ key, enabled }) => ({ key, value: "", enabled, type: ROW_FILE, ...EMPTY_ATTACHMENT })

function ColumnLabels({ columns, typed, keyLabel, valueLabel }) {
  return (
    <div className={cn(ROW_GRID, "h-6", columns)}>
      <span />
      <SectionLabel>{keyLabel}</SectionLabel>
      {typed && <SectionLabel>{TEXT.type}</SectionLabel>}
      <SectionLabel>{valueLabel}</SectionLabel>
      <span />
    </div>
  )
}

function ValueCell({ row, label, suggest, onChange }) {
  if (isFileRow(row)) {
    return <FileField fileName={row.fileName} data={row.data} path={row.path} onChange={onChange} />
  }
  return (
    <VariableInput
      value={row.value}
      title={row.value}
      suggest={suggest}
      placeholder={label}
      aria-label={label}
      spellCheck={false}
      onChange={(event) => onChange({ value: event.target.value })}
      className="font-mono"
    />
  )
}

const sameRowProps = ({ row: before, ...beforeRest }, { row: after, ...afterRest }) => shallow(before, after) && shallow(beforeRest, afterRest)

const Row = memo(function Row({ row, index, columns, typed, isDraft, keyLabel, valueLabel, suggestions, onChange, onReplace, onRemove }) {
  const change = (patch) => onChange(index, patch)
  return (
    <div className={cn(ROW_GRID, columns, !row.enabled && "opacity-50")}>
      <Checkbox
        label={TEXT.sendRow}
        checked={row.enabled}
        onChange={(event) => change({ enabled: event.target.checked })}
        className={cn(ROW_TOGGLE, isDraft && "invisible")}
      />
      <VariableInput
        value={row.key}
        title={row.key}
        suggest={suggestions?.names}
        placeholder={keyLabel}
        aria-label={keyLabel}
        spellCheck={false}
        onChange={(event) => change({ key: event.target.value })}
        className="font-mono"
      />
      {typed && (
        <Select
          value={row.type || ROW_TEXT}
          onChange={(event) => onReplace(index, event.target.value === ROW_FILE ? asFileRow(row) : asTextRow(row))}
          aria-label={TEXT.fieldType}
        >
          <option value={ROW_TEXT}>{TEXT.text}</option>
          <option value={ROW_FILE}>{TEXT.file}</option>
        </Select>
      )}
      <ValueCell row={row} label={valueLabel} suggest={suggestions && ((text) => suggestions.values(row.key, text))} onChange={change} />
      <IconButton label={TEXT.removeRow} icon={X} onClick={() => onRemove(index)} className={cn(isDraft && "invisible")} />
    </div>
  )
}, sameRowProps)

export function BulkEditor({ rows, keyLabel, onChange }) {
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
      <VariableTextarea
        autoFocus
        value={text}
        onChange={edit}
        rows={Math.max(MIN_BULK_LINES, rows.length + 1)}
        aria-label={TEXT.bulkLabel(keyLabel)}
        aria-describedby={hintId}
        placeholder={TEXT.bulkPlaceholder(keyLabel)}
        spellCheck={false}
      />
      <p id={hintId} className="text-2xs text-muted-foreground">{TEXT.bulkHint}</p>
    </div>
  )
}

function TableEditor({ rows, typed, fileRows, keyLabel, valueLabel, suggestions, onChange }) {
  const columns = typed ? TYPED_COLUMNS : PLAIN_COLUMNS
  const shown = [...rows, draftRow(typed, fileRows)]
  const latest = useRef(null)
  latest.current = { shown, fileRows, onChange }

  const commit = useCallback((next) => {
    const { fileRows: isFile, onChange: report } = latest.current
    report(next.filter((row) => !(isFile ? isBlankFileRow(row) : isBlankRow(row))))
  }, [])
  const replaceRow = useCallback((index, replacement) => commit(latest.current.shown.map((row, at) => (at === index ? replacement : row))), [commit])
  const editRow = useCallback((index, patch) => replaceRow(index, { ...latest.current.shown[index], ...patch }), [replaceRow])
  const removeRow = useCallback((index) => commit(latest.current.shown.filter((_, at) => at !== index)), [commit])

  return (
    <>
      <ColumnLabels columns={columns} typed={typed} keyLabel={keyLabel} valueLabel={valueLabel} />
      <div className={ROW_STACK}>
        {shown.map((row, index) => (
          <Row
            key={index}
            row={row}
            index={index}
            columns={columns}
            typed={typed}
            isDraft={index === rows.length}
            keyLabel={keyLabel}
            valueLabel={valueLabel}
            suggestions={suggestions}
            onChange={editRow}
            onReplace={replaceRow}
            onRemove={removeRow}
          />
        ))}
      </div>
    </>
  )
}

export function ModeSwitch({ rows, showsBulk, onSwitch }) {
  if (showsBulk) {
    return (
      <Button variant="ghost" size="sm" onClick={() => onSwitch(false)}>
        {TEXT.editAsTable}
      </Button>
    )
  }
  if (!fitsBulkText(rows)) return <p className="text-2xs text-muted-foreground">{TEXT.bulkUnavailable}</p>
  return (
    <Button variant="ghost" size="sm" onClick={() => onSwitch(true)}>
      {TEXT.bulkEdit}
    </Button>
  )
}

export function KeyValueEditor({ rows, onChange, keyLabel = TEXT.key, valueLabel = TEXT.value, typed = false, fileRows = false, suggestions, note, children }) {
  const [isBulk, setIsBulk] = useState(false)
  const hasModeSwitch = !typed && !fileRows
  const showsBulk = isBulk && hasModeSwitch

  return (
    <PanelBody>
      {showsBulk ? (
        <BulkEditor rows={rows} keyLabel={keyLabel} onChange={onChange} />
      ) : (
        <TableEditor rows={rows} typed={typed} fileRows={fileRows} keyLabel={keyLabel} valueLabel={valueLabel} suggestions={suggestions} onChange={onChange} />
      )}
      {(hasModeSwitch || note) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {note ? <InfoTip text={note} /> : <span />}
          {hasModeSwitch && <ModeSwitch rows={rows} showsBulk={showsBulk} onSwitch={setIsBulk} />}
        </div>
      )}
      {children}
    </PanelBody>
  )
}
