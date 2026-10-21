import { useState } from "react"
import { Server, SlidersHorizontal } from "lucide-react"
import { Checkbox } from "./ui/checkbox"
import { EmptyState } from "./ui/emptyState"
import { IconButton } from "./ui/button"
import { SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { MethodTag } from "./MethodTag"
import { MockBehaviorFields } from "./MockBehaviorFields"
import { MockSpecImport } from "./MockSpecImport"
import { ROUTE_CONFLICT, ROUTE_DISABLED, ROUTE_NO_EXAMPLE, ROUTE_SERVED, emptyBehavior } from "../lib/mockServer"
import { MOCK_TEXT } from "../lib/mockText"
import { cn } from "../lib/utils"

const ROUTE_COLUMNS = "grid grid-cols-[1.25rem_3.5rem_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,11rem)_1.75rem] items-center gap-2 px-3"
const CELL = "truncate font-mono text-xs"
const SWITCHABLE = [ROUTE_SERVED, ROUTE_DISABLED, ROUTE_NO_EXAMPLE, ROUTE_CONFLICT]

function ExampleChoice({ route, examples, selected, onSelect }) {
  if (route.state === ROUTE_NO_EXAMPLE) return <span className="truncate text-xs text-muted-foreground">{MOCK_TEXT.noExample}</span>
  if (route.state !== ROUTE_SERVED) {
    return <span title={route.reason} className="truncate text-xs text-warning">{route.reason}</span>
  }
  return (
    <Select value={selected || route.exampleId} onChange={(event) => onSelect(route.requestId, event.target.value)} aria-label={MOCK_TEXT.exampleFor(route.name)}>
      {examples.map((example) => (
        <option key={example.id} value={example.id}>{example.status} {example.name}</option>
      ))}
    </Select>
  )
}

function RouteRow({ route, examples, selected, isOpen, behavior, actions, onToggleBehavior }) {
  const isServed = route.state === ROUTE_SERVED
  return (
    <div className="border-b border-border">
      <div className={`${ROUTE_COLUMNS} h-9`}>
        <Checkbox
          label={MOCK_TEXT.routeSwitch(route.name)}
          checked={route.state !== ROUTE_DISABLED}
          disabled={!SWITCHABLE.includes(route.state)}
          onChange={(event) => actions.setRouteEnabled(route.requestId, event.target.checked)}
        />
        <MethodTag method={route.method} className={cn(!isServed && "opacity-50")} />
        <span title={route.path} className={cn(CELL, isServed ? "text-foreground" : "text-muted-foreground")}>{route.path}</span>
        <span title={route.name} className="truncate text-xs text-muted-foreground">{route.name}</span>
        <ExampleChoice route={route} examples={examples} selected={selected} onSelect={actions.selectExample} />
        <IconButton label={MOCK_TEXT.routeBehavior(route.name)} icon={SlidersHorizontal} size="icon-xs" aria-expanded={isOpen} onClick={onToggleBehavior} />
      </div>
      {isOpen && (
        <div className="px-3 pb-3 pt-1">
          <MockBehaviorFields value={behavior} onChange={(next) => actions.setRouteBehavior(route.requestId, next)} />
        </div>
      )}
    </div>
  )
}

function RouteTable({ routes, examplesOf, config, actions }) {
  const [openId, setOpenId] = useState("")
  return (
    <>
      <div className={`${ROUTE_COLUMNS} h-8 shrink-0 border-b border-border`}>
        <span />
        <SectionLabel className="truncate">{MOCK_TEXT.routeColumns.method}</SectionLabel>
        <SectionLabel className="truncate">{MOCK_TEXT.routeColumns.path}</SectionLabel>
        <SectionLabel className="truncate">{MOCK_TEXT.routeColumns.request}</SectionLabel>
        <SectionLabel className="truncate">{MOCK_TEXT.routeColumns.example}</SectionLabel>
        <span />
      </div>
      <div aria-label={MOCK_TEXT.routesLabel} className="min-h-0 flex-1 overflow-y-auto">
        {routes.map((route) => (
          <RouteRow
            key={route.requestId}
            route={route}
            examples={examplesOf.get(route.requestId) || []}
            selected={config.selections[route.requestId]}
            isOpen={openId === route.requestId}
            behavior={config.routes[route.requestId]?.behavior || emptyBehavior()}
            actions={actions}
            onToggleBehavior={() => setOpenId(openId === route.requestId ? "" : route.requestId)}
          />
        ))}
      </div>
    </>
  )
}

export function MockRoutesTab({ mock, examplesOf, actions }) {
  return (
    <>
      <MockSpecImport
        spec={mock.config.spec}
        isLoading={mock.isLoadingSpec}
        onImport={actions.importSpec}
        onClear={actions.clearSpec}
        onPickFile={actions.pickSpecFile}
      />
      {mock.routes.length === 0 ? (
        <div className="min-h-0 flex-1">
          <EmptyState icon={Server} title={MOCK_TEXT.noRoutesTitle} description={MOCK_TEXT.noRoutesHint} />
        </div>
      ) : (
        <RouteTable routes={mock.routes} examplesOf={examplesOf} config={mock.config} actions={actions} />
      )}
    </>
  )
}
