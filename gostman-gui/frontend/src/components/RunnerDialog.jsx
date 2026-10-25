import { memo, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, ChevronRight, Download, ListChecks, Minus, Play, Square, Upload, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { MethodTag } from "./MethodTag"
import { TestRow, countPassed } from "./TestResults"
import { TagsInput } from "./ui/tagsInput"
import { UnresolvedNames, hasUnresolved } from "./UnresolvedNotice"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { DATA_FILE_ERROR, dataColumns, iterationCount, MAX_ITERATIONS, parseDataFile } from "../lib/runData"
import { parseJsonBody, statusVariant } from "../lib/response"
import { shownMethod } from "../lib/methodLabel"
import { requestsInScope } from "../lib/runner"
import { RUNNER_TEXT } from "../lib/runnerText"
import { summarize } from "../lib/runReport"
import { collectTags } from "../lib/tags"
import { endSummary } from "../lib/sse"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const PATH_SEPARATOR = " / "

const DATA_ACCEPT = ".csv,.json,text/csv,application/json"

const toCount = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

function NumberField({ label, className, ...props }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <Input type="number" className={cn("w-20 font-mono", className)} {...props} />
    </label>
  )
}

function TagFilterField({ label, ...props }) {
  return (
    <div className="flex min-w-[14rem] flex-1 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <TagsInput label={label} {...props} />
    </div>
  )
}

function outcomeIcon(result) {
  if (result.skipped) return { Icon: Minus, tone: "text-muted-foreground", label: RUNNER_TEXT.outcomes.skipped }
  return result.hasFailed
    ? { Icon: X, tone: "text-destructive", label: RUNNER_TEXT.outcomes.failed }
    : { Icon: Check, tone: "text-success", label: RUNNER_TEXT.outcomes.passed }
}

function ResultSummary({ result }) {
  if (result.skipped) return <span className="truncate text-xs text-muted-foreground">{RUNNER_TEXT.skipped}</span>
  return (
    <>
      {result.tests.length > 0 && (
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
          {RUNNER_TEXT.tests(countPassed(result.tests), result.tests.length)}
        </span>
      )}
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{RUNNER_TEXT.duration(result.durationMs)}</span>
      <Badge variant={result.isAnswered ? statusVariant(result) : "serverError"} className="min-w-0 max-w-[40%] shrink font-mono">
        <span className="truncate">{result.status}</span>
      </Badge>
    </>
  )
}

function readableBody(response) {
  const json = parseJsonBody(response.body)
  return json === null ? response.body : JSON.stringify(json, null, 2)
}

function ExchangeDetail({ result }) {
  const passed = result.tests.filter((test) => test.passed)
  const { request, response } = result.exchange
  const url = result.resolvedUrl || request.url
  return (
    <div className="flex flex-col gap-2 pb-1.5 pl-[1.375rem]">
      <p className="truncate font-mono text-2xs text-muted-foreground" title={url}>{url}</p>
      {passed.length > 0 && (
        <ul>
          {passed.map((test, index) => <TestRow key={index} result={test} />)}
        </ul>
      )}
      {response.body ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 font-mono text-2xs text-foreground">{readableBody(response)}</pre>
      ) : (
        <p className="text-xs text-muted-foreground">{RUNNER_TEXT.emptyBody}</p>
      )}
      {response.truncated && <p className="text-xs text-muted-foreground">{RUNNER_TEXT.truncated}</p>}
    </div>
  )
}

const ResultRow = memo(function ResultRow({ result }) {
  const { Icon, tone, label } = outcomeIcon(result)
  const [isOpen, setIsOpen] = useState(false)
  const failures = result.tests.filter((test) => !test.passed)
  const detail = result.skipped || result.error
  const streamNote = result.streamEnd ? endSummary({ endReason: result.streamEnd }) : ""
  const canExpand = Boolean(result.exchange)
  const Chevron = isOpen ? ChevronDown : ChevronRight

  return (
    <li className="border-b border-border [contain-intrinsic-size:auto_2.25rem] [content-visibility:auto]">
      <button
        type="button"
        disabled={!canExpand}
        aria-expanded={canExpand ? isOpen : undefined}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center gap-2 px-3 text-left hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", tone)} />
        <span className="sr-only">{label}</span>
        <MethodTag method={shownMethod(result)} className="w-12" />
        {result.iteration > 0 && <span className="shrink-0 font-mono text-2xs text-muted-foreground">#{result.iteration}</span>}
        <span title={`${result.name}\n${result.url}`} className="min-w-0 flex-1 truncate text-xs text-foreground">{result.name}</span>
        <ResultSummary result={result} />
        {canExpand && <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>
      <div className="px-3">
        {detail && <p className="whitespace-pre-line pb-1.5 pl-[1.375rem] text-xs text-muted-foreground">{detail}</p>}
        {hasUnresolved(result.unresolved) && (
          <p className="pb-1.5 pl-[1.375rem] text-xs text-warning">
            <UnresolvedNames names={result.unresolved} isFailed={!result.isAnswered} />
          </p>
        )}
        {streamNote && <p className="pb-1.5 pl-[1.375rem] text-xs text-muted-foreground">{streamNote}</p>}
        {failures.length > 0 && (
          <ul className="pb-1.5 pl-[1.375rem]">
            {failures.map((test, index) => <TestRow key={index} result={test} />)}
          </ul>
        )}
        {isOpen && <ExchangeDetail result={result} />}
      </div>
    </li>
  )
})

function idleTitle(isRunning, total) {
  if (isRunning) return RUNNER_TEXT.running
  return total === 0 ? RUNNER_TEXT.nothingToRun : RUNNER_TEXT.nothingRun
}

function describeRun(results, requestCount, isRunning, iterations) {
  const total = requestCount * iterations
  if (results.length === 0) return RUNNER_TEXT.inScope(requestCount, iterations)
  const { passed, failed, skipped } = summarize(results, total)
  return RUNNER_TEXT.progress({ isRunning, done: passed + failed, total, passed, failed, skipped })
}

export function RunnerDialog({ folders, requests, actions }) {
  const runner = useAppStore((s) => s.runner)
  const [folderId, setFolderId] = useState(runner.folderId)
  const [delayMs, setDelayMs] = useState(0)
  const [stopOnFailure, setStopOnFailure] = useState(false)
  const fileInput = useRef(null)
  const [parallel, setParallel] = useState(1)
  const [iterationLimit, setIterationLimit] = useState(0)
  const [rows, setRows] = useState([])
  const [dataName, setDataName] = useState("")
  const [dataError, setDataError] = useState("")
  const [includeTags, setIncludeTags] = useState([])
  const [excludeTags, setExcludeTags] = useState([])

  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const knownTags = useMemo(() => collectTags([...requests, ...folders]), [requests, folders])
  const tagFilter = useMemo(() => ({ include: includeTags, exclude: excludeTags }), [includeTags, excludeTags])
  const requestCount = useMemo(() => requestsInScope({ folders, requests }, folderId, tagFilter).length, [folders, requests, folderId, tagFilter])
  const { isRunning, results } = runner
  const iterations = iterationCount(rows, iterationLimit)
  const columns = useMemo(() => dataColumns(rows), [rows])
  const total = requestCount * iterations

  async function chooseData(event) {
    const [file] = event.target.files
    event.target.value = ""
    if (!file) return
    try {
      setRows(parseDataFile(file.name, await file.text()))
      setDataName(file.name)
      setDataError("")
    } catch (error) {
      setDataError(error instanceof SyntaxError ? DATA_FILE_ERROR.unreadable : error.message)
    }
  }

  function clearData() {
    setRows([])
    setDataName("")
    setDataError("")
  }

  return (
    <Dialog label={RUNNER_TEXT.title} size="lg" onClose={actions.closeRunner}>
      <DialogHeader onClose={actions.closeRunner}>
        <DialogTitle>{RUNNER_TEXT.title}</DialogTitle>
      </DialogHeader>
      <Toolbar className="h-auto flex-wrap py-1.5">
        <div className="w-48 shrink-0">
          <Select value={folderId} disabled={isRunning} onChange={(event) => setFolderId(event.target.value)} aria-label={RUNNER_TEXT.scope}>
            <option value={ROOT_ID}>{RUNNER_TEXT.allRequests}</option>
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </div>
        <NumberField
          label={RUNNER_TEXT.delay}
          min={0}
          step={100}
          value={delayMs || ""}
          placeholder="0"
          disabled={isRunning}
          onChange={(event) => setDelayMs(toCount(event.target.value))}
        />
        <Checkbox checked={stopOnFailure} disabled={isRunning} onChange={(event) => setStopOnFailure(event.target.checked)}>
          {RUNNER_TEXT.stopOnFailure}
        </Checkbox>
        <div className="ml-auto">
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={actions.stopRun}>
              <Square />
              {RUNNER_TEXT.stop}
            </Button>
          ) : (
            <Button size="sm" disabled={total === 0} onClick={() => actions.startRun({ folderId, delayMs, stopOnFailure, parallel, rows, iterations: iterationLimit, tagFilter })}>
              <Play />
              {RUNNER_TEXT.run}
            </Button>
          )}
        </div>
      </Toolbar>
      <Toolbar className="h-auto flex-wrap py-1.5">
        <input ref={fileInput} type="file" accept={DATA_ACCEPT} hidden onChange={chooseData} />
        <Button variant="ghost" size="sm" disabled={isRunning} onClick={() => fileInput.current.click()}>
          <Upload />
          {RUNNER_TEXT.dataFile}
        </Button>
        {dataName && (
          <Button variant="ghost" size="sm" disabled={isRunning} onClick={clearData} aria-label={RUNNER_TEXT.clearData}>
            <X />
            {dataName} · {RUNNER_TEXT.rows(rows.length)}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <NumberField
            label={RUNNER_TEXT.iterations}
            min={0}
            max={MAX_ITERATIONS}
            value={iterationLimit || ""}
            placeholder={String(iterationCount(rows, 0))}
            disabled={isRunning}
            onChange={(event) => setIterationLimit(Math.min(MAX_ITERATIONS, toCount(event.target.value)))}
          />
          <NumberField
            label={RUNNER_TEXT.parallel}
            min={1}
            value={parallel > 1 ? parallel : ""}
            placeholder="1"
            disabled={isRunning}
            onChange={(event) => setParallel(Math.max(1, toCount(event.target.value)))}
          />
        </div>
      </Toolbar>
      {knownTags.length > 0 && (
        <Toolbar className="h-auto flex-wrap py-1.5">
          <TagFilterField label={RUNNER_TEXT.includeTags} placeholder={RUNNER_TEXT.anyTag} value={includeTags} onChange={setIncludeTags} suggestions={knownTags} disabled={isRunning} />
          <TagFilterField label={RUNNER_TEXT.excludeTags} placeholder={RUNNER_TEXT.noTag} value={excludeTags} onChange={setExcludeTags} suggestions={knownTags} disabled={isRunning} />
        </Toolbar>
      )}
      {dataError && <p role="alert" className="shrink-0 px-4 py-1 text-xs text-destructive">{dataError}</p>}
      {!dataError && columns.length > 0 && <p className="shrink-0 px-4 py-1 text-xs text-muted-foreground">{RUNNER_TEXT.dataOverrides(columns)}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {results.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={idleTitle(isRunning, total)}
            description={total === 0 && !isRunning ? RUNNER_TEXT.nothingToRunHint : RUNNER_TEXT.idle}
          />
        ) : (
          <ul aria-label={RUNNER_TEXT.results}>
            {results.map((result, index) => <ResultRow key={index} result={result} />)}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border py-1 pl-4 pr-2">
        <p role="status" className="min-w-0 flex-1 text-xs text-muted-foreground">
          {describeRun(results, requestCount, isRunning, iterations)}
        </p>
        <Button variant="ghost" size="sm" disabled={isRunning || results.length === 0} onClick={actions.downloadRunReport}>
          <Download />
          {RUNNER_TEXT.report}
        </Button>
      </div>
    </Dialog>
  )
}
