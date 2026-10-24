import { Fragment } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import { ConnectionMark } from "./ConnectionMark"
import { ORIGIN_OFF, ORIGIN_UNKNOWN } from "../lib/secretOrigins"
import { REFERENCE_TEXT, SECRETS_TEXT } from "../lib/secretsText"
import { VARIABLE_TEXT } from "../lib/variables"

function ValueLine({ info }) {
  return (
    <p className="font-mono">
      <span className="text-muted-foreground">{info.name}</span>
      <span className="text-muted-foreground"> = </span>
      {info.defined ? info.shown : <span className="text-warning">{VARIABLE_TEXT.undefinedName}</span>}
      {info.source && <span className="text-muted-foreground"> ({info.source})</span>}
    </p>
  )
}

function OriginHeader({ origin }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      {origin.state !== ORIGIN_UNKNOWN && <ConnectionMark kind={origin.kind} color={origin.color} />}
      <span className="truncate font-medium text-foreground">{origin.provider}</span>
      {origin.kind && <span className="truncate text-muted-foreground">{SECRETS_TEXT.kinds[origin.kind] || origin.kind}</span>}
    </p>
  )
}

function OriginTarget({ origin }) {
  const rows = [
    [REFERENCE_TEXT.path, origin.path],
    [REFERENCE_TEXT.fieldNames[origin.kind] || REFERENCE_TEXT.field, origin.field],
    [REFERENCE_TEXT.versions[origin.kind] || REFERENCE_TEXT.version, origin.version],
  ].filter(([, value]) => value)
  if (rows.length === 0) return null
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono [overflow-wrap:anywhere]">{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

function OriginNote({ origin }) {
  if (origin.state === ORIGIN_OFF) return <p className="text-muted-foreground">{REFERENCE_TEXT.connectionOff(origin.provider)}</p>
  if (origin.state === ORIGIN_UNKNOWN) return <p className="text-warning">{REFERENCE_TEXT.missingConnection(origin.provider)}</p>
  return null
}

function SecretOrigin({ origin }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-1">
      <OriginHeader origin={origin} />
      <OriginTarget origin={origin} />
      <OriginNote origin={origin} />
    </div>
  )
}

export function VariableCard({ info }) {
  return (
    <div className="flex flex-col gap-1 font-sans">
      <ValueLine info={info} />
      {info.origin && <SecretOrigin origin={info.origin} />}
    </div>
  )
}

export function mountVariableCard(info) {
  const dom = document.createElement("div")
  const root = createRoot(dom)
  flushSync(() => root.render(<VariableCard info={info} />))
  return { dom, destroy: () => queueMicrotask(() => root.unmount()) }
}
