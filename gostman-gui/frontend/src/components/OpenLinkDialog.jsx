import { useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { SkeletonLines } from "./ui/skeleton"
import { describeCounts } from "../lib/importCounts"
import { FORMAT_LABELS } from "../lib/importText"
import { pluralize } from "../lib/dataUtils"
import { OPEN_LINK_TEXT } from "../lib/openLinkText"
import { describeShared } from "../lib/shareContent"

const ASK = { status: "ask" }
const FETCHING = { status: "fetching" }
const READY = "ready"
const FAILED = "failed"

const failure = (error) => ({ status: FAILED, error })

async function download(address, fetchLink, importer) {
  let reply
  try {
    reply = await fetchLink(address)
  } catch {
    return failure(OPEN_LINK_TEXT.reachFailure)
  }
  if (reply.error) return failure(reply.error)
  const result = await importer.read([reply.file], "auto", {})
  if (!result.success) return failure(result.error)
  return { status: READY, result, host: reply.host }
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Source({ link }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label={OPEN_LINK_TEXT.hostLabel}>
        <p className="text-sm font-semibold text-foreground">{link.host}</p>
      </Field>
      <Field label={OPEN_LINK_TEXT.addressLabel}>
        <p className="break-all rounded-md border border-border p-2 font-mono text-xs text-foreground">{link.url}</p>
      </Field>
    </div>
  )
}

function Detected({ result, host }) {
  const [source] = result.sources
  const format = FORMAT_LABELS[source.format] || source.format
  const { activeCount } = describeShared(result)
  return (
    <div role="status" className="flex flex-col gap-1 text-xs [overflow-wrap:anywhere]">
      <p className="text-foreground">{OPEN_LINK_TEXT.downloadedFrom(host)}</p>
      <p className="font-medium text-foreground">{OPEN_LINK_TEXT.detected(format)}</p>
      <p className="text-foreground">{describeCounts(source)}</p>
      {activeCount > 0 && <p className="text-warning">{OPEN_LINK_TEXT.activeNote(pluralize(activeCount, "item"))}</p>}
      {(result.notes || []).map((note) => <p key={note} className="text-muted-foreground">{note}</p>)}
      {(result.warnings || []).map((warning) => <p key={warning} className="text-warning">{warning}</p>)}
      {(result.skipped || []).map((note) => <p key={note} className="text-muted-foreground">{note}</p>)}
    </div>
  )
}

function Review({ link, fetchLink, importer, onImport, onClose }) {
  const [state, setState] = useState(ASK)

  const start = async () => {
    setState(FETCHING)
    setState(await download(link.url, fetchLink, importer))
  }

  const confirm = async () => {
    if (await onImport(state.result)) onClose()
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{OPEN_LINK_TEXT.intro}</p>
        <Source link={link} />
        <p className="text-xs text-warning">{OPEN_LINK_TEXT.trustNote}</p>
        {state === FETCHING && <SkeletonLines label={OPEN_LINK_TEXT.downloading} lines={3} className="p-0" />}
        {state.status === FAILED && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
        {state.status === READY && <Detected result={state.result} host={state.host} />}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" autoFocus onClick={onClose}>{OPEN_LINK_TEXT.cancel}</Button>
        {state.status === READY
          ? <Button size="sm" onClick={confirm}>{OPEN_LINK_TEXT.import}</Button>
          : <Button size="sm" disabled={state === FETCHING} onClick={start}>{OPEN_LINK_TEXT.download}</Button>}
      </DialogFooter>
    </>
  )
}

function Invalid({ error, onClose }) {
  return (
    <>
      <DialogBody>
        <p role="alert" className="text-sm text-destructive">{error}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" autoFocus onClick={onClose}>{OPEN_LINK_TEXT.cancel}</Button>
      </DialogFooter>
    </>
  )
}

export function OpenLinkDialog({ link, fetchLink, importer, onImport, onClose }) {
  return (
    <Dialog label={OPEN_LINK_TEXT.title} className="max-w-xl" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{link.error ? OPEN_LINK_TEXT.invalidTitle : OPEN_LINK_TEXT.title}</DialogTitle>
      </DialogHeader>
      {link.error
        ? <Invalid error={link.error} onClose={onClose} />
        : <Review key={link.url} link={link} fetchLink={fetchLink} importer={importer} onImport={onImport} onClose={onClose} />}
    </Dialog>
  )
}
