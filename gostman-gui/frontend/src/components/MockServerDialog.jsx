import { useMemo } from "react"
import { AlertTriangle, Check, Copy, MonitorDown, Play, Server, Square } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { TabCount } from "./ui/tabs"
import { MethodTag } from "./MethodTag"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { pluralize } from "../lib/dataUtils"
import { parseExamples } from "../lib/examples"
import { ROUTE_CONFLICT, ROUTE_NO_EXAMPLE, ROUTE_SERVED, toDelayMs, toPort, useMockStore } from "../lib/mockServer"
import { statusVariant } from "../lib/response"
import { cn } from "../lib/utils"

const PATH_SEPARATOR = " / "
const WEB_NOTICE = "The mock server needs the desktop app. Examples you save here are kept with your requests and included in exports."
const NO_ROUTES_HINT = "Save a request, then save one of its responses as an example to serve it."
const NO_MATCH = "No route"
const ROUTE_COLUMNS = "grid grid-cols-[3rem_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,12rem)] items-center gap-2 px-3"
const LOG_COLUMNS = "grid grid-cols-[4.5rem_3rem_minmax(0,1.5fr)_minmax(0,1fr)_2.5rem_3.5rem] items-center gap-2 px-3"
const CELL = "truncate font-mono text-xs"

const countIn = (routes, state) => routes.filter((route) => route.state === state).length

function describeRoutes(routes) {
  const served = countIn(routes, ROUTE_SERVED)
  const withoutExample = countIn(routes, ROUTE_NO_EXAMPLE)
  const conflicts = countIn(routes, ROUTE_CONFLICT)
  const skipped = routes.length - served - withoutExample - conflicts
  return [
    `${pluralize(served, "route")} served`,
    withoutExample > 0 && `${withoutExample} with no example`,
    conflicts > 0 && pluralize(conflicts, "conflict"),
    skipped > 0 && `${skipped} not served`,
  ].filter(Boolean).join(" · ")
}

function BaseUrl({ address }) {
  const { copied, copy } = useClipboardCopy(address)
  return (
    <div className="ml-auto flex min-w-0 items-center gap-1">
      <span title={address} className="min-w-0 truncate font-mono text-xs text-foreground">{address}</span>
      <IconButton label={copied ? "Copied" : "Copy base URL"} icon={copied ? Check : Copy} onClick={copy} />
    </div>
  )
}

function ExampleChoice({ route, examples, onSelect }) {
  if (route.state === ROUTE_NO_EXAMPLE) return <span className="truncate text-xs text-muted-foreground">No example</span>
  if (route.state !== ROUTE_SERVED) {
    return <span title={route.reason} className="truncate text-xs text-warning">{route.reason}</span>
  }
  return (
    <Select value={route.exampleId} onChange={(event) => onSelect(route.requestId, event.target.value)} aria-label={`Example for ${route.name}`}>
      {examples.map((example) => (
        <option key={example.id} value={example.id}>{example.status} {example.name}</option>
      ))}
    </Select>
  )
}

function RouteRow({ route, examples, onSelect }) {
  const isServed = route.state === ROUTE_SERVED
  return (
    <div className={`${ROUTE_COLUMNS} h-9 border-b border-border`}>
      <MethodTag method={route.method} className={cn(!isServed && "opacity-50")} />
      <span title={route.path} className={cn(CELL, isServed ? "text-foreground" : "text-muted-foreground")}>{route.path}</span>
      <span title={route.name} className="truncate text-xs text-muted-foreground">{route.name}</span>
      <ExampleChoice route={route} examples={examples} onSelect={onSelect} />
    </div>
  )
}

function RouteTable({ routes, examplesOf, onSelect }) {
  return (
    <>
      <div className={`${ROUTE_COLUMNS} h-8 shrink-0 border-b border-border`}>
        <SectionLabel className="truncate">Method</SectionLabel>
        <SectionLabel className="truncate">Path</SectionLabel>
        <SectionLabel className="truncate">Request</SectionLabel>
        <SectionLabel className="truncate">Example</SectionLabel>
      </div>
      <div aria-label="Routes" className="min-h-0 flex-1 overflow-y-auto">
        {routes.map((route) => (
          <RouteRow key={route.requestId} route={route} examples={examplesOf.get(route.requestId) || []} onSelect={onSelect} />
        ))}
      </div>
    </>
  )
}

function LogRow({ entry }) {
  return (
    <li className={`${LOG_COLUMNS} h-7 border-b border-border`}>
      <span className={`${CELL} text-muted-foreground`}>{new Date(entry.time).toLocaleTimeString([], { hour12: false })}</span>
      <MethodTag method={entry.method} />
      <span title={entry.path} className={`${CELL} text-foreground`}>{entry.path}</span>
      <span title={entry.route || NO_MATCH} className="truncate text-xs text-muted-foreground">{entry.route || NO_MATCH}</span>
      <Badge variant={statusVariant({ statusCode: entry.status })} className="justify-self-start font-mono">{entry.status}</Badge>
      <span className={`${CELL} text-right text-muted-foreground`}>{entry.durationMs} ms</span>
    </li>
  )
}

function RequestLog({ log, isRunning, onClear }) {
  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-2 border-y border-border pl-3 pr-1.5">
        <SectionLabel>Requests</SectionLabel>
        <TabCount>{log.length}</TabCount>
        <Button variant="ghost" size="sm" className="ml-auto" disabled={log.length === 0} onClick={onClear}>Clear</Button>
      </div>
      <div className="h-40 shrink-0 overflow-y-auto">
        {log.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {isRunning ? "Requests to the mock server appear here." : "Start the server to see incoming requests."}
          </p>
        ) : (
          <ul aria-label="Incoming requests">
            {log.map((entry) => <LogRow key={entry.id} entry={entry} />)}
          </ul>
        )}
      </div>
    </>
  )
}

function ServerControls({ mock, scopes, actions }) {
  const { isRunning, isStarting, settings, folderId } = mock
  return (
    <Toolbar>
      <div className="w-44 shrink-0">
        <Select value={folderId} onChange={(event) => actions.setScope(event.target.value)} aria-label="Requests to serve">
          <option value={ROOT_ID}>All requests</option>
          {scopes.map(({ folder, path }) => (
            <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
          ))}
        </Select>
      </div>
      <Input
        type="number"
        min={1}
        value={settings.port || ""}
        placeholder="Port"
        aria-label="Port"
        title="Port on 127.0.0.1"
        disabled={isRunning}
        onChange={(event) => actions.setSettings({ port: toPort(event.target.value) })}
        className="w-20 shrink-0 font-mono"
      />
      <Input
        type="number"
        min={0}
        step={100}
        value={settings.delayMs || ""}
        placeholder="Delay (ms)"
        aria-label="Response delay in milliseconds"
        disabled={isRunning}
        onChange={(event) => actions.setSettings({ delayMs: toDelayMs(event.target.value) })}
        className="w-28 shrink-0 font-mono"
      />
      <Checkbox checked={settings.cors} disabled={isRunning} onChange={(event) => actions.setSettings({ cors: event.target.checked })}>
        Allow CORS
      </Checkbox>
      <div className="ml-auto">
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={actions.stop}>
            <Square />
            Stop
          </Button>
        ) : (
          <Button size="sm" disabled={isStarting} onClick={actions.start}>
            <Play />
            Start
          </Button>
        )}
      </div>
    </Toolbar>
  )
}

function ServerPanel({ folders, requests, actions }) {
  const mock = useMockStore()
  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, requests)), [folders, requests])
  const examplesOf = useMemo(
    () => new Map(requests.map((request) => [request.id, parseExamples(request.examples)])),
    [requests]
  )

  return (
    <>
      <ServerControls mock={mock} scopes={scopes} actions={actions} />
      {mock.failure && <Notice tone="destructive" icon={AlertTriangle} role="alert">{mock.failure}</Notice>}
      {mock.routes.length === 0 ? (
        <div className="min-h-0 flex-1">
          <EmptyState icon={Server} title="No requests to serve" description={NO_ROUTES_HINT} />
        </div>
      ) : (
        <RouteTable routes={mock.routes} examplesOf={examplesOf} onSelect={actions.selectExample} />
      )}
      <RequestLog log={mock.log} isRunning={mock.isRunning} onClear={actions.clearLog} />
      <p role="status" className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {describeRoutes(mock.routes)}
      </p>
    </>
  )
}

export function MockServerDialog({ folders, requests, actions }) {
  const isRunning = useMockStore((state) => state.isRunning)
  const address = useMockStore((state) => state.address)

  return (
    <Dialog label="Mock server" size="lg" onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>Mock server</DialogTitle>
        {isRunning && <Badge variant="success">Running</Badge>}
        {isRunning && <BaseUrl address={address} />}
      </DialogHeader>
      {actions.isAvailable ? (
        <ServerPanel folders={folders} requests={requests} actions={actions} />
      ) : (
        <div className="min-h-0 flex-1">
          <EmptyState icon={MonitorDown} title="Available in the desktop app" description={WEB_NOTICE} />
        </div>
      )}
    </Dialog>
  )
}
