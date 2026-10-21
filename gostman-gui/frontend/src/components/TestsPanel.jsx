import { Suspense, useMemo, useState } from "react"
import { X } from "lucide-react"
import { IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Panel, PanelBody, SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Select } from "./ui/select"
import { ROW_GRID, ROW_STACK } from "./KeyValueEditor"
import {
  BLANK_ASSERTION, OPERATORS, isBlankAssertion, operatorOf, parseAssertions, serializeAssertions,
} from "../lib/scripting/assertions"
import { cn } from "../lib/utils"

const VIEW_ASSERTIONS = "assertions"
const VIEW_PRE = "preScript"
const VIEW_POST = "postScript"

const VIEWS = [
  { value: VIEW_ASSERTIONS, label: "Assertions" },
  { value: VIEW_PRE, label: "Pre-request script" },
  { value: VIEW_POST, label: "Post-response script" },
]

const HINTS = {
  [VIEW_ASSERTIONS]: "Checked rows are verified after every response. Use res.status, res.headers.name, res.body.path or res.responseTime.",
  [VIEW_PRE]: "Runs before sending. Available: req, env.get(), env.set(), console.log().",
  [VIEW_POST]: "Runs after the response. Available: req, res, env, test(name, fn), expect(value).",
}

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1.25fr)_9rem_minmax(0,1fr)_1.75rem]"

function ColumnLabels() {
  return (
    <div className={cn(ROW_GRID, "h-6", COLUMNS)}>
      <span />
      <SectionLabel className="truncate">Expression</SectionLabel>
      <SectionLabel className="truncate">Check</SectionLabel>
      <SectionLabel className="truncate">Expected</SectionLabel>
      <span />
    </div>
  )
}

function AssertionRow({ assertion, isDraft, onChange, onRemove }) {
  const isUnary = Boolean(operatorOf(assertion).unary)
  return (
    <div className={cn(ROW_GRID, COLUMNS, !assertion.enabled && "opacity-50")}>
      <Checkbox
        label="Verify this assertion"
        checked={assertion.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        className={cn(isDraft && "invisible")}
      />
      <Input
        value={assertion.expression}
        title={assertion.expression}
        placeholder="res.status"
        aria-label="Expression"
        spellCheck={false}
        onChange={(event) => onChange({ expression: event.target.value })}
        className="font-mono"
      />
      <Select value={assertion.operator} onChange={(event) => onChange({ operator: event.target.value })} aria-label="Check">
        {OPERATORS.map((operator) => (
          <option key={operator.value} value={operator.value}>{operator.label}</option>
        ))}
      </Select>
      <Input
        value={isUnary ? "" : assertion.value}
        title={assertion.value}
        placeholder={isUnary ? "" : "200"}
        aria-label="Expected value"
        spellCheck={false}
        disabled={isUnary}
        onChange={(event) => onChange({ value: event.target.value })}
        className="font-mono"
      />
      <IconButton label="Remove assertion" icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
    </div>
  )
}

export function AssertionEditor({ assertions, onChange }) {
  const rows = useMemo(() => parseAssertions(assertions), [assertions])
  const shown = [...rows, BLANK_ASSERTION]

  const commit = (next) => onChange(serializeAssertions(next.filter((row) => !isBlankAssertion(row))))
  const patchRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <PanelBody>
      <ColumnLabels />
      <div className={ROW_STACK}>
        {shown.map((row, index) => (
          <AssertionRow
            key={index}
            assertion={row}
            isDraft={index === rows.length}
            onChange={(patch) => patchRow(index, patch)}
            onRemove={() => removeRow(index)}
          />
        ))}
      </div>
    </PanelBody>
  )
}

export function ScriptEditor({ value, path, onChange, EditorComponent }) {
  return (
    <div className="min-h-0 flex-1">
      <Suspense fallback={<p className="p-3 text-xs text-muted-foreground">Loading editor</p>}>
        <EditorComponent
          value={value}
          onChange={(event) => onChange(event.target.value)}
          language="javascript"
          path={path}
          height="100%"
        />
      </Suspense>
    </div>
  )
}

export function TestsPanel({ request, editorPath, onUpdateRequest, EditorComponent }) {
  const [view, setView] = useState(VIEW_ASSERTIONS)

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label="Tests section" options={VIEWS} value={view} onChange={setView} />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={HINTS[view]}>{HINTS[view]}</p>
      </Toolbar>
      {view === VIEW_ASSERTIONS ? (
        <AssertionEditor assertions={request.assertions} onChange={(assertions) => onUpdateRequest({ assertions })} />
      ) : (
        <ScriptEditor
          key={view}
          value={request[view]}
          path={`${editorPath}/${view}`}
          onChange={(script) => onUpdateRequest({ [view]: script })}
          EditorComponent={EditorComponent}
        />
      )}
    </Panel>
  )
}
