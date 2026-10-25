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
  EXTRACTOR_SCOPES,
  EXTRACTOR_SOURCES,
  SOURCE_STATUS,
  defaultExtractScope,
  isBlankExtractor,
  isUsableResponse,
  parseExtractors,
  serializeExtractors,
} from "../lib/chaining"
import { EXTRACT_TEXT as TEXT } from "../lib/extractText"
import { useExtractPreview } from "../hooks/useExtractPreview"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const COLUMNS = "grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_7rem_minmax(0,1.25fr)_1.75rem]"

const hintFor = (source) => EXTRACTOR_SOURCES.find((candidate) => candidate.value === source).hint

function describeRun(extraction) {
  if (extraction?.error) return extraction.error
  if (!extraction?.written) return ""
  if (!extraction.saved) return TEXT.invalidEnvironment
  const lines = EXTRACTOR_SCOPES.filter((scope) => extraction.written[scope]?.length > 0).map((scope) => TEXT.savedTo[scope](extraction.written[scope]))
  return lines.length > 0 ? lines.join(" ") : TEXT.nothing
}

function outcomeFor(extractor, response, preview) {
  if (!response) return { reason: TEXT.noResponse }
  if (!isUsableResponse(response)) return { reason: TEXT.failedResponse }
  return preview(extractor)
}

function Outcome({ outcome }) {
  const text = outcome.reason || String(outcome.value)
  return (
    <span title={text} className={cn("text-xs", outcome.reason ? "line-clamp-3 text-muted-foreground [overflow-wrap:anywhere]" : "truncate font-mono text-foreground")}>
      {text}
    </span>
  )
}

function ColumnLabels() {
  return (
    <div className={cn(ROW_GRID, "h-6", COLUMNS)}>
      <span />
      {[TEXT.variable, TEXT.from, TEXT.path, TEXT.keepIn, TEXT.value].map((label) => (
        <SectionLabel key={label} className="truncate" title={label}>{label}</SectionLabel>
      ))}
      <span />
    </div>
  )
}

function ExtractorRow({ extractor, isDraft, response, preview, fallbackScope, onChange, onRemove }) {
  const readsStatus = extractor.source === SOURCE_STATUS
  return (
    <div className={cn(ROW_GRID, COLUMNS, !extractor.enabled && "opacity-50")}>
      <Checkbox
        label={TEXT.run}
        checked={extractor.enabled}
        onChange={(event) => onChange({ enabled: event.target.checked })}
        className={cn(isDraft && "invisible")}
      />
      <Input
        dir="ltr"
        value={extractor.name}
        title={extractor.name}
        placeholder={TEXT.namePlaceholder}
        aria-label={TEXT.name}
        spellCheck={false}
        onChange={(event) => onChange({ name: event.target.value })}
        className="font-mono"
      />
      <Select value={extractor.source} onChange={(event) => onChange({ source: event.target.value })} aria-label={TEXT.source}>
        {EXTRACTOR_SOURCES.map((source) => (
          <option key={source.value} value={source.value}>{source.label}</option>
        ))}
      </Select>
      <Input
        dir="ltr"
        value={readsStatus ? "" : extractor.expression}
        title={extractor.expression}
        placeholder={hintFor(extractor.source)}
        aria-label={TEXT.path}
        spellCheck={false}
        disabled={readsStatus}
        onChange={(event) => onChange({ expression: event.target.value })}
        className="font-mono"
      />
      <Select value={extractor.scope || fallbackScope} onChange={(event) => onChange({ scope: event.target.value })} aria-label={TEXT.scope}>
        {EXTRACTOR_SCOPES.map((scope) => (
          <option key={scope} value={scope}>{TEXT.scopes[scope]}</option>
        ))}
      </Select>
      {isDraft ? <span /> : <Outcome outcome={outcomeFor(extractor, response, preview)} />}
      <IconButton label={TEXT.remove} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
    </div>
  )
}

export function ExtractPanel({ extractors, response, extraction, onChange, onRun }) {
  const workspacePath = useAppStore((state) => state.workspaceStatus.path)
  const rows = useMemo(() => parseExtractors(extractors), [extractors])
  const shown = [...rows, BLANK_EXTRACTOR]
  const preview = useExtractPreview(rows, response)
  const runSummary = describeRun(extraction)
  const fallbackScope = defaultExtractScope(workspacePath)

  const commit = (next) => onChange(serializeExtractors(next.filter((row) => !isBlankExtractor(row))))
  const patchRow = (index, patch) => commit(shown.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  const removeRow = (index) => commit(shown.filter((_, at) => at !== index))

  return (
    <Panel>
      <Toolbar className="h-auto min-h-10 py-1.5">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">{TEXT.summary}</p>
        <Button variant="outline" size="sm" className="shrink-0" disabled={rows.length === 0 || !isUsableResponse(response)} onClick={onRun}>
          <Play />
          {TEXT.runNow}
        </Button>
      </Toolbar>
      <PanelBody className="overflow-x-auto">
        <div className="min-w-[42rem]">
          <ColumnLabels />
          <div className={ROW_STACK}>
            {shown.map((row, index) => (
              <ExtractorRow
                key={index}
                extractor={row}
                isDraft={index === rows.length}
                response={response}
                preview={preview}
                fallbackScope={fallbackScope}
                onChange={(patch) => patchRow(index, patch)}
                onRemove={() => removeRow(index)}
              />
            ))}
          </div>
        </div>
        {runSummary && <p className="pt-3 text-xs text-muted-foreground">{runSummary}</p>}
      </PanelBody>
    </Panel>
  )
}
