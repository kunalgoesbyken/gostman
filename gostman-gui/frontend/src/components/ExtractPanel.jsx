import { useMemo } from "react"
import { Play, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
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

const COLUMNS = "grid-cols-[1rem_minmax(0,1fr)_7.5rem_minmax(0,1fr)_minmax(0,1.25fr)_1.75rem]"
const CELL_INPUT = "h-8 px-2 font-mono text-xs"
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
    <span
      title={text}
      className={cn("truncate text-xs", outcome.reason ? "text-muted-foreground" : "font-mono text-foreground")}
    >
      {text}
    </span>
  )
}

function ColumnLabels() {
  return (
    <div className={cn("grid items-center gap-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", COLUMNS)}>
      <span />
      <span>Variable</span>
      <span>From</span>
      <span>Path or name</span>
      <span>Value in last response</span>
      <span />
    </div>
  )
}

function ExtractorRow({ extractor, isDraft, response, onChange, onRemove }) {
  const readsStatus = extractor.source === SOURCE_STATUS
  return (
    <div className={cn("grid items-center gap-2", COLUMNS, !extractor.enabled && "opacity-50")}>
      <input
        type="checkbox"
        checked={extractor.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        aria-label="Run this extractor"
        className={cn("h-3.5 w-3.5 accent-primary", isDraft && "invisible")}
      />
      <Input
        value={extractor.name}
        placeholder="variable_name"
        aria-label="Variable name"
        spellCheck={false}
        onChange={(event) => onChange({ name: event.target.value })}
        className={CELL_INPUT}
      />
      <Select
        value={extractor.source}
        onChange={(event) => onChange({ source: event.target.value })}
        aria-label="Value source"
        className="h-8 px-2 text-xs"
      >
        {EXTRACTOR_SOURCES.map((source) => (
          <option key={source.value} value={source.value}>{source.label}</option>
        ))}
      </Select>
      <Input
        value={readsStatus ? "" : extractor.expression}
        placeholder={hintFor(extractor.source)}
        aria-label="Path or name"
        spellCheck={false}
        disabled={readsStatus}
        onChange={(event) => onChange({ expression: event.target.value })}
        className={CELL_INPUT}
      />
      {isDraft ? <span /> : <Outcome outcome={outcomeFor(extractor, response)} />}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="Remove extractor"
        className={cn("h-7 w-7 text-muted-foreground hover:text-destructive", isDraft && "invisible")}
      >
        <X />
      </Button>
    </div>
  )
}

export function ExtractPanel({ extractors, response, extraction, onChange, onRun }) {
  const rows = useMemo(() => parseExtractors(extractors), [extractors])
  const shown = [...rows, BLANK_EXTRACTOR]

  const commit = (next) => onChange(serializeExtractors(next.filter((row) => !isBlankExtractor(row))))
  const patchRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4">
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={SUMMARY}>{SUMMARY}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2"
          disabled={rows.length === 0 || !isUsableResponse(response)}
          onClick={onRun}
        >
          <Play />
          Run now
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scrollbar-primary">
        <ColumnLabels />
        <div className="flex flex-col gap-1">
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
        <p className="pt-3 text-xs text-muted-foreground">{describeRun(extraction)}</p>
      </div>
    </div>
  )
}
