import { useMemo } from "react"
import { Play, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { Panel, PanelBody, SectionLabel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { ROW_GRID, ROW_STACK } from "./KeyValueEditor"
import {
  BLANK_EXTRACTOR,
  EXTRACTOR_SOURCES,
  SOURCE_STATUS,
  evaluateExtractor,
  isBlankExtractor,
  isUsableResponse,
  parseExtractors,
  serializeExtractors,
} from "../lib/chaining"
import { cn } from "../lib/utils"

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_minmax(0,1.25fr)_1.75rem]"
const NO_RESPONSE = "Send the request to see a value"
const FAILED_RESPONSE = "The last request failed"
const SUMMARY = "Checked rows run after every response and save their value to the active environment, ready to use as {{variable_name}}."

const hintFor = (source) => EXTRACTOR_SOURCES.find((candidate) => candidate.value === source).hint

function describeRun(extraction) {
  if (!extraction) return ""
  if (!extraction.saved) return "Nothing was saved: the active environment's variables are not valid JSON."
  if (extraction.names.length === 0) return "The last run produced no values."
  return `Saved ${extraction.names.join(", ")} to the active environment.`
}

function outcomeFor(extractor, response) {
  if (!response) return { reason: NO_RESPONSE }
  if (!isUsableResponse(response)) return { reason: FAILED_RESPONSE }
  return evaluateExtractor(extractor, response)
}

function Outcome({ outcome }) {
  const text = outcome.reason || String(outcome.value)
  return (
    <span title={text} className={cn("truncate text-xs", outcome.reason ? "text-muted-foreground" : "font-mono text-foreground")}>
      {text}
    </span>
  )
}

function ColumnLabels() {
  return (
    <div className={cn(ROW_GRID, "h-6", COLUMNS)}>
      <span />
      <SectionLabel className="truncate" title="Variable">Variable</SectionLabel>
      <SectionLabel className="truncate" title="From">From</SectionLabel>
      <SectionLabel className="truncate" title="Path or name">Path or name</SectionLabel>
      <SectionLabel className="truncate" title="Value in last response">Value in last response</SectionLabel>
      <span />
    </div>
  )
}

function ExtractorRow({ extractor, isDraft, response, onChange, onRemove }) {
  const readsStatus = extractor.source === SOURCE_STATUS
  return (
    <div className={cn(ROW_GRID, COLUMNS, !extractor.enabled && "opacity-50")}>
      <Checkbox
        label="Run this extractor"
        checked={extractor.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        className={cn(isDraft && "invisible")}
      />
      <Input
        value={extractor.name}
        title={extractor.name}
        placeholder="variable_name"
        aria-label="Variable name"
        spellCheck={false}
        onChange={(event) => onChange({ name: event.target.value })}
        className="font-mono"
      />
      <Select value={extractor.source} onChange={(event) => onChange({ source: event.target.value })} aria-label="Value source">
        {EXTRACTOR_SOURCES.map((source) => (
          <option key={source.value} value={source.value}>{source.label}</option>
        ))}
      </Select>
      <Input
        value={readsStatus ? "" : extractor.expression}
        title={extractor.expression}
        placeholder={hintFor(extractor.source)}
        aria-label="Path or name"
        spellCheck={false}
        disabled={readsStatus}
        onChange={(event) => onChange({ expression: event.target.value })}
        className="font-mono"
      />
      {isDraft ? <span /> : <Outcome outcome={outcomeFor(extractor, response)} />}
      <IconButton label="Remove extractor" icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
    </div>
  )
}

export function ExtractPanel({ extractors, response, extraction, onChange, onRun }) {
  const rows = useMemo(() => parseExtractors(extractors), [extractors])
  const shown = [...rows, BLANK_EXTRACTOR]
  const runSummary = describeRun(extraction)

  const commit = (next) => onChange(serializeExtractors(next.filter((row) => !isBlankExtractor(row))))
  const patchRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <Panel>
      <Toolbar>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={SUMMARY}>{SUMMARY}</p>
        <Button variant="outline" size="sm" disabled={rows.length === 0 || !isUsableResponse(response)} onClick={onRun}>
          <Play />
          Run now
        </Button>
      </Toolbar>
      <PanelBody>
        <ColumnLabels />
        <div className={ROW_STACK}>
          {shown.map((row, index) => (
            <ExtractorRow
              key={index}
              extractor={row}
              isDraft={index === rows.length}
              response={response}
              onChange={(patch) => patchRow(index, patch)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </div>
        {runSummary && <p className="pt-3 text-xs text-muted-foreground">{runSummary}</p>}
      </PanelBody>
    </Panel>
  )
}
