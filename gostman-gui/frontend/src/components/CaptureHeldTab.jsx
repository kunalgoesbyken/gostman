import { useState } from "react"
import { Hand } from "lucide-react"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { Textarea } from "./ui/textarea"
import { MethodTag } from "./MethodTag"
import { headersToText, textToHeaders } from "../lib/captureRules"
import { CAPTURE_HELD_TEXT as TEXT } from "../lib/captureText"
import { formatTime } from "../lib/i18n/format"

const ENCODING_BASE64 = "base64"
const PHASE_RESPONSE = "response"
const CLOCK_OPTIONS = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }

function HeldEditor({ held, actions }) {
  const isResponse = held.phase === PHASE_RESPONSE
  const isBinary = held.bodyEncoding === ENCODING_BASE64
  const [method, setMethod] = useState(held.method)
  const [url, setUrl] = useState(held.url)
  const [status, setStatus] = useState(String(held.status || ""))
  const [headers, setHeaders] = useState(headersToText(held.headers))
  const [body, setBody] = useState(held.body)

  const decision = () => ({
    drop: false,
    method,
    url,
    status: Number(status) || 0,
    headers: textToHeaders(headers),
    body,
    bodyEncoding: held.bodyEncoding,
  })

  return (
    <section aria-label={isResponse ? TEXT.response : TEXT.request} className="flex flex-col gap-2 border-b border-border p-3">
      <Toolbar>
        <SectionLabel>{isResponse ? TEXT.response : TEXT.request}</SectionLabel>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{TEXT.heldBy({ rule: held.rule })}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{TEXT.expires({ time: formatTime(held.expiresAt, CLOCK_OPTIONS) })}</span>
        <Button variant="outline" size="sm" title={TEXT.dropTitle} onClick={() => actions.drop(held.id)}>{TEXT.drop}</Button>
        <Button size="sm" onClick={() => actions.release(held.id, decision())}>{TEXT.release}</Button>
      </Toolbar>
      {isResponse ? (
        <Input type="number" value={status} aria-label={TEXT.status} placeholder={TEXT.status} onChange={(event) => setStatus(event.target.value)} className="w-28 font-mono" />
      ) : (
        <div className="flex items-center gap-2">
          <MethodTag method={method} />
          <Input value={method} aria-label={TEXT.method} onChange={(event) => setMethod(event.target.value)} className="w-28 font-mono" />
          <Input value={url} aria-label={TEXT.url} spellCheck={false} onChange={(event) => setUrl(event.target.value)} className="min-w-0 flex-1 font-mono" />
        </div>
      )}
      <Textarea rows={5} value={headers} aria-label={TEXT.headers} onChange={(event) => setHeaders(event.target.value)} className="font-mono" />
      {isBinary ? (
        <Notice>{TEXT.binaryBody}</Notice>
      ) : (
        <Textarea rows={8} value={body} aria-label={TEXT.body} onChange={(event) => setBody(event.target.value)} className="font-mono" />
      )}
    </section>
  )
}

export function CaptureHeldTab({ held, actions }) {
  if (held.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <EmptyState icon={Hand} title={TEXT.emptyTitle} description={TEXT.emptyHint} />
      </div>
    )
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-label={TEXT.listLabel}>
      {held.map((one) => <HeldEditor key={one.id} held={one} actions={actions} />)}
    </div>
  )
}
