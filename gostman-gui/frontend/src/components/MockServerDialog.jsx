import { useMemo } from "react"
import { AlertTriangle, Play, Square } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { Notice, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger, TabCount } from "./ui/tabs"
import { DesktopOnly } from "./DesktopOnly"
import { LocalAddress } from "./LocalAddress"
import { MockBehaviorTab } from "./MockBehaviorTab"
import { MockLogTab } from "./MockLogTab"
import { MockRoutesTab } from "./MockRoutesTab"
import { MockRulesTab } from "./MockRulesTab"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { parseExamples } from "../lib/examples"
import {
  ROUTE_CONFLICT,
  ROUTE_DISABLED,
  ROUTE_NO_EXAMPLE,
  ROUTE_SERVED,
  TAB_BEHAVIOR,
  TAB_LOG,
  TAB_ROUTES,
  TAB_RULES,
  toPort,
  useMockStore,
} from "../lib/mockServer"
import { MOCK_TEXT } from "../lib/mockText"

const PATH_SEPARATOR = " / "
const SUMMARY_SEPARATOR = " · "

const countIn = (routes, state) => routes.filter((route) => route.state === state).length

function describeRoutes(routes) {
  const served = countIn(routes, ROUTE_SERVED)
  const withoutExample = countIn(routes, ROUTE_NO_EXAMPLE)
  const conflicts = countIn(routes, ROUTE_CONFLICT)
  const off = countIn(routes, ROUTE_DISABLED)
  const skipped = routes.length - served - withoutExample - conflicts - off
  const summary = MOCK_TEXT.routeSummary
  return [
    summary.served(served),
    withoutExample > 0 && summary.noExample(withoutExample),
    conflicts > 0 && summary.conflicts(conflicts),
    off > 0 && summary.off(off),
    skipped > 0 && summary.skipped(skipped),
  ].filter(Boolean).join(SUMMARY_SEPARATOR)
}

function ServerControls({ mock, scopes, actions }) {
  const { isRunning, isStarting, config, folderId } = mock
  return (
    <Toolbar>
      <div className="w-44 shrink-0">
        <Select value={folderId} onChange={(event) => actions.setScope(event.target.value)} aria-label={MOCK_TEXT.scope}>
          <option value={ROOT_ID}>{MOCK_TEXT.allRequests}</option>
          {scopes.map(({ folder, path }) => (
            <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
          ))}
        </Select>
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title={MOCK_TEXT.portTitle}>
        {MOCK_TEXT.port}
        <Input
          type="number"
          min={1}
          value={config.settings.port || ""}
          disabled={isRunning}
          onChange={(event) => actions.setSettings({ port: toPort(event.target.value) })}
          className="w-20 font-mono"
        />
      </label>
      <div className="ms-auto">
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={actions.stop}>
            <Square />
            {MOCK_TEXT.stop}
          </Button>
        ) : (
          <Button size="sm" disabled={isStarting} onClick={actions.start}>
            <Play />
            {MOCK_TEXT.start}
          </Button>
        )}
      </div>
    </Toolbar>
  )
}

function ServerTabs({ mock }) {
  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border px-3">
      <TabsList label={MOCK_TEXT.title}>
        <TabsTrigger value={TAB_ROUTES}>{MOCK_TEXT.tabs.routes}<TabCount>{mock.routes.length}</TabCount></TabsTrigger>
        <TabsTrigger value={TAB_RULES}>{MOCK_TEXT.tabs.rules}<TabCount>{mock.config.rules.length}</TabCount></TabsTrigger>
        <TabsTrigger value={TAB_BEHAVIOR}>{MOCK_TEXT.tabs.behavior}</TabsTrigger>
        <TabsTrigger value={TAB_LOG}>{MOCK_TEXT.tabs.log}<TabCount>{mock.log.length}</TabCount></TabsTrigger>
      </TabsList>
    </div>
  )
}

function ServerPanel({ folders, requests, actions }) {
  const mock = useMockStore()
  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, requests)), [folders, requests])
  const examplesOf = useMemo(
    () => new Map([...requests, ...mock.config.spec.sources].map((source) => [source.id, parseExamples(source.examples)])),
    [requests, mock.config.spec]
  )

  return (
    <Tabs value={mock.tab} onValueChange={actions.setTab} className="flex min-h-0 flex-1 flex-col">
      <ServerControls mock={mock} scopes={scopes} actions={actions} />
      {mock.failure && <Notice tone="destructive" icon={AlertTriangle} role="alert">{mock.failure}</Notice>}
      <ServerTabs mock={mock} />
      <TabsContent value={TAB_ROUTES} className="flex min-h-0 flex-1 flex-col">
        <MockRoutesTab mock={mock} examplesOf={examplesOf} actions={actions} />
      </TabsContent>
      <TabsContent value={TAB_RULES} className="flex min-h-0 flex-1 flex-col">
        <MockRulesTab rules={mock.config.rules} actions={actions} />
      </TabsContent>
      <TabsContent value={TAB_BEHAVIOR} className="flex min-h-0 flex-1 flex-col">
        <MockBehaviorTab settings={mock.config.settings} actions={actions} />
      </TabsContent>
      <TabsContent value={TAB_LOG} className="flex min-h-0 flex-1 flex-col">
        <MockLogTab log={mock.log} isRunning={mock.isRunning} onClear={actions.clearLog} />
      </TabsContent>
      <p role="status" className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {describeRoutes(mock.routes)}
      </p>
    </Tabs>
  )
}

const MOCK_WINDOW = { id: "mock", width: 768, height: 576, minWidth: 480, minHeight: 360 }

export function MockServerDialog({ folders, requests, actions }) {
  const isRunning = useMockStore((state) => state.isRunning)
  const address = useMockStore((state) => state.address)

  return (
    <Dialog label={MOCK_TEXT.title} size={actions.isAvailable ? "lg" : "sm"} floating={actions.isAvailable ? MOCK_WINDOW : undefined} onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{MOCK_TEXT.title}</DialogTitle>
        {isRunning && <Badge variant="success">{MOCK_TEXT.running}</Badge>}
        {isRunning && <LocalAddress address={address} />}
      </DialogHeader>
      {actions.isAvailable ? (
        <ServerPanel folders={folders} requests={requests} actions={actions} />
      ) : (
        <DesktopOnly title={MOCK_TEXT.desktopOnly} description={MOCK_TEXT.webNotice} />
      )}
    </Dialog>
  )
}
