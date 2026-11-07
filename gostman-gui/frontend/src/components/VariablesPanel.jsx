import { useMemo, useState } from "react"
import { SlidersHorizontal, X } from "lucide-react"
import { BulkEditor, ModeSwitch, ROW_GRID, ROW_STACK } from "./KeyValueEditor"
import { ScopeMark, hasScopeMark } from "./ScopeMark"
import { VariableInput } from "./VariableInput"
import { VariableValueField } from "./VariableValueField"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { IconButton } from "./ui/button"
import { Input } from "./ui/input"
import { InfoTip } from "./ui/infoTip"
import { PanelBody, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { isBlankRow } from "../lib/rows"
import { updatePreferences, usePreferences } from "../lib/preferences"
import { PROBLEM_REQUIRED, TYPE_BOOLEAN, TYPE_ENUM, TYPE_NONE, VARIABLE_TYPES, keepRowSettings, problemOf, problemText, typeOf } from "../lib/requestVariables"
import { KEY_VALUE_TEXT } from "../lib/keyValueText"
import { REQUEST_TABS_TEXT } from "../lib/requestTabsText"
import { REQUEST_VARIABLES_TEXT } from "../lib/requestVariablesText"
import { VARIABLE_TEXT } from "../lib/variablesText"
import { VARIABLES_PANEL_TEXT as TEXT } from "../lib/variablesPanelText"
import { selectResolvedVariables, useAppStore } from "../store/appStore"
import { cn } from "../lib/utils"

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_7.5rem_minmax(0,1.5fr)_1.75rem_1.75rem]"
const HIDDEN_VALUE = "••••••"
const REQUEST_SOURCE = "request"
const NONE_OPEN = -1

const draftRow = () => ({ key: "", value: "", enabled: true })

const typeName = (type) => REQUEST_VARIABLES_TEXT.types[type || "none"]

const hasFieldSettings = (row) => Boolean(row.label || row.help || row.placeholder || row.choices || row.required || row.hidden)

const isEmptyRow = (row) => isBlankRow(row) && !hasFieldSettings(row) && typeOf(row) === TYPE_NONE

function ColumnLabels() {
  return (
    <div className={cn(ROW_GRID, "h-6", COLUMNS)}>
      <span />
      <SectionLabel>{REQUEST_TABS_TEXT.variableLabel}</SectionLabel>
      <span className="flex items-center gap-1">
        <SectionLabel>{TEXT.type}</SectionLabel>
        <InfoTip text={REQUEST_VARIABLES_TEXT.typeHint} />
      </span>
      <SectionLabel>{TEXT.value}</SectionLabel>
      <span />
      <span />
    </div>
  )
}

function FieldOptions({ row, onChange }) {
  const type = typeOf(row)
  return (
    <div className="ms-8 mb-2 mt-1 flex max-w-xl flex-col gap-2 border-s border-border ps-3">
      <Field label={TEXT.label}>
        <Input value={row.label ?? ""} placeholder={TEXT.labelPlaceholder} onChange={(event) => onChange({ label: event.target.value })} />
      </Field>
      <Field label={TEXT.help}>
        <Input value={row.help ?? ""} placeholder={TEXT.helpPlaceholder} onChange={(event) => onChange({ help: event.target.value })} />
      </Field>
      {type !== TYPE_BOOLEAN && (
        <Field label={TEXT.placeholder}>
          <Input value={row.placeholder ?? ""} placeholder={TEXT.placeholderPlaceholder} onChange={(event) => onChange({ placeholder: event.target.value })} />
        </Field>
      )}
      {type === TYPE_ENUM && (
        <Field label={TEXT.choices}>
          <Input value={row.choices ?? ""} placeholder={TEXT.choicesPlaceholder} onChange={(event) => onChange({ choices: event.target.value })} className="font-mono" />
        </Field>
      )}
      <div className="flex flex-wrap gap-x-4">
        {type !== TYPE_BOOLEAN && (
          <Checkbox checked={row.required === true} onChange={(event) => onChange({ required: event.target.checked })}>{TEXT.required}</Checkbox>
        )}
        <Checkbox checked={row.hidden !== true} onChange={(event) => onChange({ hidden: !event.target.checked })}>{TEXT.inForm}</Checkbox>
      </div>
    </div>
  )
}

function VariableRow({ row, isDraft, isOpen, onChange, onRemove, onToggleOptions }) {
  const problem = problemOf(row)
  const hasTypeProblem = problem !== "" && problem !== PROBLEM_REQUIRED
  return (
    <>
      <div className={cn(ROW_GRID, COLUMNS, !row.enabled && "opacity-50")}>
        <Checkbox
          label={KEY_VALUE_TEXT.sendRow}
          checked={row.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className={cn(isDraft && "invisible")}
        />
        <VariableInput
          value={row.key}
          title={row.key}
          placeholder={REQUEST_TABS_TEXT.variableLabel}
          aria-label={REQUEST_TABS_TEXT.variableLabel}
          spellCheck={false}
          onChange={(event) => onChange({ key: event.target.value })}
          className="font-mono"
        />
        <Select value={typeOf(row)} onChange={(event) => onChange({ type: event.target.value })} aria-label={TEXT.typeLabel}>
          {VARIABLE_TYPES.map((type) => <option key={type || "none"} value={type}>{typeName(type)}</option>)}
        </Select>
        <VariableValueField row={row} label={TEXT.value} onChange={onChange} />
        <IconButton
          label={TEXT.fieldOptions}
          icon={SlidersHorizontal}
          aria-pressed={isOpen}
          onClick={onToggleOptions}
          className={cn(isDraft && "invisible", hasFieldSettings(row) && !isOpen && "text-primary")}
        />
        <IconButton label={KEY_VALUE_TEXT.removeRow} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
      </div>
      {hasTypeProblem && <p role="alert" className="ms-8 text-2xs text-destructive">{problemText(row, problem)}</p>}
      {isOpen && !isDraft && <FieldOptions row={row} onChange={onChange} />}
    </>
  )
}

function Table({ rows, onChange }) {
  const [openAt, setOpenAt] = useState(NONE_OPEN)
  const shown = [...rows, draftRow()]
  const commit = (next) => onChange(next.filter((row) => !isEmptyRow(row)))
  const replaceRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => {
    setOpenAt(NONE_OPEN)
    commit(shown.filter((_, at) => at !== index))
  }

  return (
    <div className="min-w-[36rem]">
      <ColumnLabels />
      <div className={ROW_STACK}>
        {shown.map((row, index) => (
          <VariableRow
            key={index}
            row={row}
            isDraft={index === rows.length}
            isOpen={openAt === index}
            onChange={(patch) => replaceRow(index, patch)}
            onRemove={() => removeRow(index)}
            onToggleOptions={() => setOpenAt(openAt === index ? NONE_OPEN : index)}
          />
        ))}
      </div>
    </div>
  )
}

const shownValue = ({ secret, value }) => (secret ? HIDDEN_VALUE : value)

function Source({ entry }) {
  if (hasScopeMark(entry.source)) return <ScopeMark source={entry.source} label={entry.owner || ""} />
  return <span className="truncate">{VARIABLE_TEXT.sources[entry.source]}</span>
}

function InheritedList() {
  const resolved = useAppStore(selectResolvedVariables)
  const inherited = useMemo(
    () => Array.from(resolved, ([name, details]) => ({ name, ...details })).filter(({ source }) => source !== REQUEST_SOURCE),
    [resolved]
  )

  return (
    <section aria-label={TEXT.inheritedTitle} className="mt-3 border-t border-border pt-2">
      <div className="mb-1 flex items-center gap-2">
        <SectionLabel>{TEXT.inheritedTitle}</SectionLabel>
        <InfoTip text={TEXT.inheritedHint} />
      </div>
      {inherited.length === 0 ? (
        <p className="text-xs text-muted-foreground">{TEXT.inheritedNone}</p>
      ) : (
        <ul className="flex min-w-[36rem] flex-col">
          {inherited.map((entry) => (
            <li key={entry.name} className="grid h-7 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_8rem] items-center gap-x-2 text-xs">
              <span className="truncate font-mono text-foreground" title={entry.name}>{entry.name}</span>
              <span className="truncate font-mono text-muted-foreground" title={entry.secret ? TEXT.hiddenValue : entry.value}>{shownValue(entry)}</span>
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground"><Source entry={entry} /></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function VariablesPanel({ rows, onChange }) {
  const [isBulk, setIsBulk] = useState(false)
  const { showInheritedVariables } = usePreferences()

  return (
    <PanelBody>
      {isBulk ? (
        <BulkEditor rows={rows} keyLabel={REQUEST_TABS_TEXT.variableLabel} onChange={(next) => onChange(keepRowSettings(rows, next))} />
      ) : (
        <div className="overflow-x-auto">
          <Table rows={rows} onChange={onChange} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={showInheritedVariables} onChange={(event) => updatePreferences({ showInheritedVariables: event.target.checked })}>
            {TEXT.showInherited}
          </Checkbox>
          <InfoTip text={TEXT.typeNote} />
        </div>
        <ModeSwitch rows={rows} showsBulk={isBulk} onSwitch={setIsBulk} />
      </div>
      {showInheritedVariables && <div className="overflow-x-auto"><InheritedList /></div>}
    </PanelBody>
  )
}
