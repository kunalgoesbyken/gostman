import { Suspense, useMemo, useState } from "react"
import { Braces, X } from "lucide-react"
import { AddChecksAction } from "./AddChecksAction"
import { AiButton } from "./AiButton"
import { AI_TEXT } from "../lib/aiText"
import { IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Panel, PanelBody, SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { EditorSkeleton } from "./ui/skeleton"
import { ROW_GRID, ROW_STACK } from "./KeyValueEditor"
import { SchemaDialog } from "./SchemaDialog"
import { VariableInput } from "./VariableInput"
import {
  BLANK_ASSERTION, OPERATORS, SCHEMA_OPERATOR, isBlankAssertion, operatorOf, parseAssertions, serializeAssertions,
} from "../lib/scripting/assertions"
import { SCHEMA_TEXT, TESTS_TEXT as TEXT } from "../lib/checksText"
import { TASK_SCRIPT, TASK_TESTS } from "../lib/ai/tasks"
import { cn } from "../lib/utils"

const VIEW_ASSERTIONS = "assertions"
const VIEW_PRE = "preScript"
const VIEW_POST = "postScript"

const viewOptions = () => [VIEW_ASSERTIONS, VIEW_PRE, VIEW_POST].map((value) => ({ value, label: TEXT.views[value] }))

const hasScript = (script) => typeof script === "string" && script.trim() !== ""

const firstFilledView = (request) => {
  if (parseAssertions(request.assertions).length > 0) return VIEW_ASSERTIONS
  return [VIEW_POST, VIEW_PRE].find((view) => hasScript(request[view])) ?? VIEW_ASSERTIONS
}

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1.25fr)_9rem_minmax(0,1fr)_1.75rem]"

function ColumnLabels() {
  return (
    <div className={cn(ROW_GRID, "h-6", COLUMNS)}>
      <span />
      <SectionLabel className="truncate">{TEXT.expression}</SectionLabel>
      <SectionLabel className="truncate">{TEXT.check}</SectionLabel>
      <SectionLabel className="truncate">{TEXT.expected}</SectionLabel>
      <span />
    </div>
  )
}

function ExpectedInput({ assertion, isUnary, placeholder = TEXT.expectedPlaceholder, onChange, className }) {
  return (
    <VariableInput
      value={isUnary ? "" : assertion.value}
      title={assertion.value}
      placeholder={isUnary ? TEXT.noExpectedValue : placeholder}
      aria-label={TEXT.expectedValue}
      spellCheck={false}
      disabled={isUnary}
      onChange={(event) => onChange({ value: event.target.value })}
      className={cn("font-mono", className)}
    />
  )
}

function AssertionRow({ assertion, isDraft, onChange, onRemove, onEditSchema }) {
  const isUnary = Boolean(operatorOf(assertion).unary)
  const isSchema = assertion.operator === SCHEMA_OPERATOR && onEditSchema
  return (
    <div className={cn(ROW_GRID, COLUMNS, !assertion.enabled && "opacity-50")}>
      <Checkbox
        label={TEXT.verify}
        checked={assertion.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        className={cn(isDraft && "invisible")}
      />
      <Input
        value={assertion.expression}
        title={assertion.expression}
        placeholder="res.status"
        aria-label={TEXT.expression}
        spellCheck={false}
        onChange={(event) => onChange({ expression: event.target.value })}
        className="font-mono"
      />
      <Select value={assertion.operator} onChange={(event) => onChange({ operator: event.target.value })} aria-label={TEXT.check}>
        {OPERATORS.map((operator) => (
          <option key={operator.value} value={operator.value}>{operator.label}</option>
        ))}
      </Select>
      {isSchema ? (
        <div className="flex min-w-0 items-center gap-1">
          <ExpectedInput assertion={assertion} isUnary={false} placeholder={TEXT.schemaPlaceholder} onChange={onChange} className="min-w-0 flex-1" />
          <IconButton label={SCHEMA_TEXT.edit} icon={Braces} onClick={onEditSchema} />
        </div>
      ) : (
        <ExpectedInput assertion={assertion} isUnary={isUnary} onChange={onChange} />
      )}
      <IconButton label={TEXT.remove} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
    </div>
  )
}

export function AssertionEditor({ assertions, onChange, EditorComponent }) {
  const rows = useMemo(() => parseAssertions(assertions), [assertions])
  const shown = [...rows, BLANK_ASSERTION]
  const [editing, setEditing] = useState(null)

  const commit = (next) => onChange(serializeAssertions(next.filter((row) => !isBlankAssertion(row))))
  const patchRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <PanelBody className="overflow-x-auto">
      <div className="min-w-[30rem]">
        <ColumnLabels />
        <div className={ROW_STACK}>
          {shown.map((row, index) => (
            <AssertionRow
              key={index}
              assertion={row}
              isDraft={index === rows.length}
              onChange={(patch) => patchRow(index, patch)}
              onRemove={() => removeRow(index)}
              onEditSchema={EditorComponent && (() => setEditing(index))}
            />
          ))}
        </div>
      </div>
      {editing !== null && (
        <SchemaDialog
          value={shown[editing].value}
          EditorComponent={EditorComponent}
          onSave={(value) => patchRow(editing, { value })}
          onClose={() => setEditing(null)}
        />
      )}
    </PanelBody>
  )
}

export function ScriptEditor({ value, path, label, onChange, EditorComponent }) {
  return (
    <div className="min-h-0 flex-1">
      <Suspense fallback={<EditorSkeleton />}>
        <EditorComponent
          value={value}
          onChange={(event) => onChange(event.target.value)}
          language="javascript"
          path={path}
          height="100%"
          surface="script"
          label={label}
        />
      </Suspense>
    </div>
  )
}

export function TestsPanel({ request, editorPath, onUpdateRequest, EditorComponent, ai }) {
  const [choice, setChoice] = useState(() => ({ id: request.id, view: firstFilledView(request) }))
  const view = choice.id === request.id ? choice.view : firstFilledView(request)
  const setView = (next) => setChoice({ id: request.id, view: next })
  const askAi = () => (view === VIEW_ASSERTIONS ? ai.start(TASK_TESTS) : ai.start(TASK_SCRIPT, { scriptKind: view }))

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label={TEXT.sectionLabel} options={viewOptions()} value={view} onChange={setView} />
        <div className="ms-auto flex items-center gap-2">
          {view === VIEW_ASSERTIONS && <AddChecksAction />}
          {ai && (
            <AiButton label={view === VIEW_ASSERTIONS ? AI_TEXT.buttons.generateTests : AI_TEXT.buttons.generateScript} onClick={askAi}>
              {AI_TEXT.buttons.generate}
            </AiButton>
          )}
        </div>
      </Toolbar>
      <p className="shrink-0 border-b border-border px-3 py-2 text-xs text-muted-foreground">{TEXT.hints[view]}</p>
      {view === VIEW_ASSERTIONS ? (
        <AssertionEditor assertions={request.assertions} onChange={(assertions) => onUpdateRequest({ assertions })} EditorComponent={EditorComponent} />
      ) : (
        <ScriptEditor
          key={view}
          value={request[view]}
          path={`${editorPath}/${view}`}
          label={TEXT.views[view]}
          onChange={(script) => onUpdateRequest({ [view]: script })}
          EditorComponent={EditorComponent}
        />
      )}
    </Panel>
  )
}
