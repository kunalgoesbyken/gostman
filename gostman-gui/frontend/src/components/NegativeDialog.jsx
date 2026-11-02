import { useMemo, useRef, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { FeatureEmpty } from "./FeatureEmpty"
import { Input } from "./ui/input"
import { MethodTag } from "./MethodTag"
import { Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { ROOT_ID, buildCollectionTree, listFolders } from "../lib/collectionTree"
import { DEFAULT_LIMIT, DEFAULT_RATE, hostsOfPlan, planNegative, variantCount } from "../lib/negativeRun"
import { NEGATIVE_TEXT as TEXT } from "../lib/negativeText"
import { useAppStore } from "../store/appStore"

const NEGATIVE_WINDOW = { id: "negative", width: 768, height: 576, minWidth: 480, minHeight: 360 }
const PATH_SEPARATOR = " / "
const SEVERITY_VARIANTS = { high: "destructive", medium: "warning", low: "secondary" }

const toPositive = (text, fallback) => {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function NumberField({ label, ...props }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <Input type="number" min={1} className="w-20 font-mono" {...props} />
    </label>
  )
}

function SeverityBadge({ severity }) {
  return <Badge variant={SEVERITY_VARIANTS[severity]} className="w-16 shrink-0 justify-center">{TEXT.severity[severity]}</Badge>
}

function VariantList({ plan }) {
  return (
    <details className="border-b border-border">
      <summary className="flex min-h-9 cursor-pointer items-center px-4 text-xs font-medium text-foreground hover:bg-accent">{TEXT.variantsTitle}</summary>
      <ul className="pb-2">
        {plan.map(({ request, variants }) => (
          <li key={request.id} className="px-4 py-1 text-xs">
            <div className="flex items-center gap-2">
              <MethodTag method={request.method} className="w-12" />
              <span className="min-w-0 truncate text-foreground">{request.name}</span>
            </div>
            <ul className="ps-14 text-muted-foreground">
              {variants.map((variant) => (
                <li key={variant.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{variant.label}</span>
                  <SeverityBadge severity={variant.severity} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Findings({ findings }) {
  const groups = Object.values(Object.groupBy(findings, (found) => found.requestId))
  return (
    <ul>
      {groups.map((group) => (
        <li key={group[0].requestId} className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 text-xs">
            <MethodTag method={group[0].method} className="w-12" />
            <span className="min-w-0 truncate font-medium text-foreground">{group[0].requestName}</span>
          </div>
          <ul className="ps-14 pt-1">
            {group.map((found, index) => (
              <li key={index} className="flex items-start gap-2 py-0.5 text-xs text-muted-foreground">
                <SeverityBadge severity={found.severity} />
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{found.message}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export function NegativeDialog({ folders, actions, initialFolderId }) {
  const requests = useAppStore((s) => s.requests)
  const [folderId, setFolderId] = useState(initialFolderId)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [status, setStatus] = useState({ isRunning: false, sent: 0, isDone: false })
  const [findings, setFindings] = useState([])
  const stopped = useRef(false)

  const scopes = useMemo(() => listFolders(buildCollectionTree(folders, [])), [folders])
  const plan = useMemo(() => planNegative(useAppStore.getState(), folderId), [requests, folders, folderId])
  const hosts = useMemo(() => hostsOfPlan(useAppStore.getState(), plan), [plan])
  const total = Math.min(variantCount(plan), limit)
  const canStart = total > 0 && isConfirmed && hosts.length > 0 && !status.isRunning

  const start = async () => {
    stopped.current = false
    setFindings([])
    setStatus({ isRunning: true, sent: 0, isDone: false })
    await actions.negative.run(plan, {
      rate,
      limit,
      isStopped: () => stopped.current,
      onSent: (sent) => setStatus((current) => ({ ...current, sent })),
      onFinding: (found) => setFindings((current) => [...current, found]),
    })
    setStatus((current) => ({ ...current, isRunning: false, isDone: true }))
  }

  const changeScope = (event) => {
    setFolderId(event.target.value)
    setIsConfirmed(false)
    setStatus({ isRunning: false, sent: 0, isDone: false })
    setFindings([])
  }

  return (
    <Dialog label={TEXT.title} size="lg" floating={NEGATIVE_WINDOW} onClose={actions.negative.close}>
      <DialogHeader onClose={actions.negative.close}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">{TEXT.intro}</p>
      <Toolbar className="h-auto flex-wrap py-1.5">
        <div className="w-48 shrink-0">
          <Select value={folderId} disabled={status.isRunning} onChange={changeScope} aria-label={TEXT.scope}>
            <option value={ROOT_ID}>{TEXT.allRequests}</option>
            {scopes.map(({ folder, path }) => (
              <option key={folder.id} value={folder.id}>{path.join(PATH_SEPARATOR)}</option>
            ))}
          </Select>
        </div>
        <NumberField label={TEXT.rate} value={rate} disabled={status.isRunning} onChange={(event) => setRate(toPositive(event.target.value, DEFAULT_RATE))} />
        <NumberField label={TEXT.limit} value={limit} disabled={status.isRunning} onChange={(event) => setLimit(toPositive(event.target.value, DEFAULT_LIMIT))} />
        {status.isRunning ? (
          <Button size="sm" variant="outline" className="ms-auto" onClick={() => { stopped.current = true }}>{TEXT.stop}</Button>
        ) : (
          <Button size="sm" className="ms-auto" disabled={!canStart} onClick={start}>{TEXT.start}</Button>
        )}
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {plan.length === 0 || variantCount(plan) === 0 ? (
          <FeatureEmpty surface="negative" />
        ) : (
          <>
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
              <p className="text-xs font-medium text-foreground">{TEXT.hostsTitle}</p>
              <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{hosts.length > 0 ? hosts.join(", ") : TEXT.noHosts}</p>
              <Checkbox checked={isConfirmed} disabled={status.isRunning || hosts.length === 0} onChange={(event) => setIsConfirmed(event.target.checked)} className="h-7 justify-start self-start">
                {TEXT.confirm}
              </Checkbox>
              <p role="status" className="text-xs text-muted-foreground">
                {status.isRunning || status.isDone ? TEXT.progress({ sent: status.sent, total }) : TEXT.plan(total)}
              </p>
            </div>
            <VariantList plan={plan} />
            {status.isDone && findings.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                <p className="text-foreground">{TEXT.noFindings}</p>
                <p>{TEXT.noFindingsHint}</p>
              </div>
            )}
            {findings.length > 0 && <Findings findings={findings} />}
            {status.isDone && <p className="px-4 py-2 text-xs text-muted-foreground">{TEXT.done({ sent: status.sent, count: findings.length })}</p>}
          </>
        )}
      </div>
    </Dialog>
  )
}
