import { useMemo, useState } from "react"
import { Check, ListChecks, Minus, Play, Square, X } from "lucide-react"
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
import { statusVariant } from "../lib/response"
import { cn } from "../lib/utils"

const PATH_SEPARATOR = " / "

const toDelayMs = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

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
      <Badge variant={result.statusCode ? statusVariant(result.statusCode) : "serverError"} className="max-w-[9rem] font-mono">
        <span className="truncate">{result.status}</span>
      </Badge>
    </>
  )
}

function ResultRow({ result }) {
  const { Icon, tone } = outcomeIcon(result)
  const failures = result.tests.filter((test) => !test.passed)
  const detail = result.skipped || result.error

  return (
    <li className="border-b border-border px-3 py-1.5">
      <div className="flex h-6 items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
        <MethodTag method={result.method} className="w-12" />
        <span title={`${result.name}\n${result.url}`} className="min-w-0 flex-1 truncate text-xs text-foreground">{result.name}</span>
        <ResultSummary result={result} />
      </div>
      {detail && <p className="pl-[1.375rem] text-xs text-muted-foreground">{detail}</p>}
      {failures.length > 0 && (
        <ul className="pl-[1.375rem]">
          {failures.map((test, index) => <TestRow key={index} result={test} />)}
        </ul>
      )}
    </li>
  )
}

function describeRun(results, total, isRunning) {
  if (results.length === 0) return `${pluralize(total, "request")} in scope.`
  const failed = results.filter((result) => result.hasFailed).length
  const progress = isRunning ? `Running ${results.length} of ${total}` : `Ran ${results.length} of ${total}`
  return `${progress} · ${results.length - failed} passed · ${failed} failed`
}

export function RunnerDialog({ runner, folders, requests, actions }) {
  const [folderId, setFolderId] = useState(runner.folderId)
  const [delayMs, setDelayMs] = useState(0)
  const [stopOnFailure, setStopOnFailure] = useState(false)

  const tree = useMemo(() => buildCollectionTree(folders, requests), [folders, requests])
  const scopes = useMemo(() => listFolders(tree), [tree])
  const total = useMemo(() => collectRequests(tree, folderId).length, [tree, folderId])
  const { isRunning, results } = runner

  return (
    <Dialog label="Run requests" size="lg" onClose={actions.closeRunner}>
      <DialogHeader onClose={actions.closeRunner}>
        <DialogTitle>Run requests</DialogTitle>
      </DialogHeader>
      <Toolbar>
        <div className="w-48 shrink-0">
          <Select value={folderId} disabled={isRunning} onChange={(event) => setFolderId(event.target.value)} aria-label="Requests to run">
            <option value={ROOT_ID}>All requests</option>
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </div>
        <Input
          type="number"
          min={0}
          step={100}
          value={delayMs || ""}
          placeholder="Delay (ms)"
          aria-label="Delay between requests in milliseconds"
          disabled={isRunning}
          onChange={(event) => setDelayMs(toDelayMs(event.target.value))}
          className="w-28 shrink-0 font-mono"
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
            <Button size="sm" disabled={total === 0} onClick={() => actions.startRun({ folderId, delayMs, stopOnFailure })}>
              <Play />
              Run
            </Button>
          )}
        </div>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {results.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={isRunning ? "Running" : "Nothing run yet"}
            description="Requests run in sidebar order with their scripts, extraction rules and assertions, using the active environment."
          />
        ) : (
          <ul aria-label="Run results">
            {results.map((result, index) => <ResultRow key={index} result={result} />)}
          </ul>
        )}
      </div>
      <p role="status" className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {describeRun(results, total, isRunning)}
      </p>
    </Dialog>
  )
}
