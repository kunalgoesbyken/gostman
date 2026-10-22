import { useMemo, useRef, useState } from "react"
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
import { ROOT_ID, buildCollectionTree, collectRequests, listFolders } from "../lib/collectionTree"
import { pluralize } from "../lib/dataUtils"
import { DATA_FILE_ERROR, iterationCount, MAX_ITERATIONS, parseDataFile } from "../lib/runData"
import { parseJsonBody, statusVariant } from "../lib/response"
import { endSummary } from "../lib/sse"
import { cn } from "../lib/utils"

const PATH_SEPARATOR = " / "

const LABELS = {
  delay: "Delay (ms)",
  iterations: "Iterations",
  parallel: "Parallel",
  dataFile: "Data file (CSV or JSON)",
  clearData: "Remove the data file",
  report: "Download HTML report",
  emptyBody: "The response had no body.",
  truncated: "Only the start of a long body is kept in a run. Send the request on its own to see all of it.",
  idle: "Requests run in sidebar order with their scripts, extraction rules and assertions, using the active environment. A data file runs everything once per row. With parallel above 1, requests are sent together and do not see each other's extracted variables.",
}
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

function outcomeIcon(result) {
  if (result.skipped) return { Icon: Minus, tone: "text-muted-foreground" }
  return result.hasFailed ? { Icon: X, tone: "text-destructive" } : { Icon: Check, tone: "text-success" }
}

function ResultSummary({ result }) {
  if (result.skipped) return <span className="truncate text-xs text-muted-foreground">Skipped</span>
  return (
    <>
      {result.tests.length > 0 && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {countPassed(result.tests)}/{result.tests.length} tests
        </span>
      )}
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{result.durationMs} ms</span>
      <Badge variant={result.isAnswered ? statusVariant(result) : "serverError"} className="max-w-[9rem] font-mono">
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
  const url = response.url || request.url
  return (
    <div className="flex flex-col gap-2 pb-1.5 pl-[1.375rem]">
      <p className="truncate font-mono text-[11px] text-muted-foreground" title={url}>{url}</p>
      {passed.length > 0 && (
        <ul>
          {passed.map((test, index) => <TestRow key={index} result={test} />)}
        </ul>
      )}
      {response.body ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] text-foreground">{readableBody(response)}</pre>
      ) : (
        <p className="text-xs text-muted-foreground">{LABELS.emptyBody}</p>
      )}
      {response.truncated && <p className="text-xs text-muted-foreground">{LABELS.truncated}</p>}
    </div>
  )
}

function ResultRow({ result }) {
  const { Icon, tone } = outcomeIcon(result)
  const [isOpen, setIsOpen] = useState(false)
  const failures = result.tests.filter((test) => !test.passed)
  const detail = result.skipped || result.error
  const streamNote = result.streamEnd ? endSummary({ endReason: result.streamEnd }) : ""
  const canExpand = Boolean(result.exchange)
  const Chevron = isOpen ? ChevronDown : ChevronRight

  return (
    <li className="border-b border-border">
      <button
        type="button"
        disabled={!canExpand}
        aria-expanded={canExpand ? isOpen : undefined}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center gap-2 px-3 text-left hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
        <MethodTag method={result.method} className="w-12" />
        {result.iteration > 0 && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">#{result.iteration}</span>}
        <span title={`${result.name}\n${result.url}`} className="min-w-0 flex-1 truncate text-xs text-foreground">{result.name}</span>
        <ResultSummary result={result} />
        {canExpand && <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      </button>
      <div className="px-3">
        {detail && <p className="whitespace-pre-line pb-1.5 pl-[1.375rem] text-xs text-muted-foreground">{detail}</p>}
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
}

function describeRun(results, total, isRunning, iterations) {
  if (results.length === 0) {
    const scope = pluralize(total, "request")
    return iterations > 1 ? `${scope} in scope, ${pluralize(iterations, "iteration")}.` : `${scope} in scope.`
  }
  const failed = results.filter((result) => result.hasFailed).length
  const progress = isRunning ? `Running ${results.length} of ${total}` : `Ran ${results.length} of ${total}`
  return `${progress} · ${results.length - failed} passed · ${failed} failed`
}

export function RunnerDialog({ runner, folders, requests, actions }) {
  const [folderId, setFolderId] = useState(runner.folderId)
  const [delayMs, setDelayMs] = useState(0)
  const [stopOnFailure, setStopOnFailure] = useState(false)
  const fileInput = useRef(null)
  const [parallel, setParallel] = useState(1)
  const [iterationLimit, setIterationLimit] = useState(0)
  const [rows, setRows] = useState([])
  const [dataName, setDataName] = useState("")
  const [dataError, setDataError] = useState("")

  const tree = useMemo(() => buildCollectionTree(folders, requests), [folders, requests])
  const scopes = useMemo(() => listFolders(tree), [tree])
  const requestCount = useMemo(() => collectRequests(tree, folderId).length, [tree, folderId])
  const { isRunning, results } = runner
  const iterations = iterationCount(rows, iterationLimit)
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
    <Dialog label="Run requests" size="lg" onClose={actions.closeRunner}>
      <DialogHeader onClose={actions.closeRunner}>
        <DialogTitle>Run requests</DialogTitle>
      </DialogHeader>
      <Toolbar className="h-auto flex-wrap py-1.5">
        <div className="w-48 shrink-0">
          <Select value={folderId} disabled={isRunning} onChange={(event) => setFolderId(event.target.value)} aria-label="Requests to run">
            <option value={ROOT_ID}>All requests</option>
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </div>
        <NumberField
          label={LABELS.delay}
          min={0}
          step={100}
          value={delayMs || ""}
          placeholder="0"
          disabled={isRunning}
          onChange={(event) => setDelayMs(toCount(event.target.value))}
        />
        <Checkbox checked={stopOnFailure} disabled={isRunning} onChange={(event) => setStopOnFailure(event.target.checked)}>
          Stop on failure
        </Checkbox>
        <div className="ml-auto">
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={actions.stopRun}>
              <Square />
              Stop
            </Button>
          ) : (
            <Button size="sm" disabled={total === 0} onClick={() => actions.startRun({ folderId, delayMs, stopOnFailure, parallel, rows, iterations: iterationLimit })}>
              <Play />
              Run
            </Button>
          )}
        </div>
      </Toolbar>
      <Toolbar className="h-auto flex-wrap py-1.5">
        <input ref={fileInput} type="file" accept={DATA_ACCEPT} hidden onChange={chooseData} />
        <Button variant="ghost" size="sm" disabled={isRunning} onClick={() => fileInput.current.click()}>
          <Upload />
          {LABELS.dataFile}
        </Button>
        {dataName && (
          <Button variant="ghost" size="sm" disabled={isRunning} onClick={clearData} aria-label={LABELS.clearData}>
            <X />
            {dataName} · {pluralize(rows.length, "row")}
          </Button>
        )}
        <NumberField
          label={LABELS.iterations}
          min={0}
          max={MAX_ITERATIONS}
          value={iterationLimit || ""}
          placeholder={String(iterationCount(rows, 0))}
          disabled={isRunning}
          onChange={(event) => setIterationLimit(Math.min(MAX_ITERATIONS, toCount(event.target.value)))}
        />
        <NumberField
          label={LABELS.parallel}
          min={1}
          value={parallel > 1 ? parallel : ""}
          placeholder="1"
          disabled={isRunning}
          onChange={(event) => setParallel(Math.max(1, toCount(event.target.value)))}
        />
      </Toolbar>
      {dataError && <p role="alert" className="shrink-0 px-4 py-1 text-xs text-destructive">{dataError}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {results.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={isRunning ? "Running" : "Nothing run yet"}
            description={LABELS.idle}
          />
        ) : (
          <ul aria-label="Run results">
            {results.map((result, index) => <ResultRow key={index} result={result} />)}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border py-1 pl-4 pr-2">
        <p role="status" className="min-w-0 flex-1 text-xs text-muted-foreground">
          {describeRun(results, total, isRunning, iterations)}
        </p>
        <Button variant="ghost" size="sm" disabled={isRunning || results.length === 0} onClick={actions.downloadRunReport}>
          <Download />
          {LABELS.report}
        </Button>
      </div>
    </Dialog>
  )
}
