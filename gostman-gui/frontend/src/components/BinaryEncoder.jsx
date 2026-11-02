import { useState } from "react"
import { Notice, SectionLabel } from "./ui/panel"
import { Button } from "./ui/button"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { bytesToBase64 } from "../lib/base64"
import { BINARY_FORMATS, FORMAT_NAMES } from "../lib/binary/formats"
import { BODY_TEXT } from "../lib/bodyText"
import { RESPONSE_TEXT } from "../lib/responseText"
import { formatBytes } from "../lib/byteSize"

const VARIABLES_EXAMPLE = "{{variables}}"

const formatOptions = () => FORMAT_NAMES.map((value) => ({ value, label: RESPONSE_TEXT.views[value] }))

export function BinaryEncoder({ onAttach }) {
  const [format, setFormat] = useState(FORMAT_NAMES[0])
  const [source, setSource] = useState("")
  const [outcome, setOutcome] = useState(null)

  const encode = async () => {
    try {
      const { encodeJson } = await import("../lib/binary/codecs")
      const bytes = encodeJson(format, source)
      const { contentType, extension } = BINARY_FORMATS[format]
      onAttach({ fileName: `body.${extension}`, contentType, data: bytesToBase64(bytes), path: "" })
      setOutcome({ tone: "success", message: BODY_TEXT.encoder.attached(formatBytes(bytes.length)) })
    } catch (error) {
      setOutcome({ tone: "destructive", message: BODY_TEXT.encoder.failed(error.message) })
    }
  }

  return (
    <section className="mt-4 flex min-w-0 flex-col gap-2">
      <SectionLabel>{BODY_TEXT.encoder.title}</SectionLabel>
      <p className="text-xs text-muted-foreground">{BODY_TEXT.encoder.description(VARIABLES_EXAMPLE)}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label={BODY_TEXT.encoder.format} options={formatOptions()} value={format} onChange={setFormat} />
        <Button size="sm" variant="outline" disabled={source.trim() === ""} onClick={encode}>{BODY_TEXT.encoder.encode}</Button>
      </div>
      <Textarea
        dir="ltr"
        rows={6}
        value={source}
        aria-label={BODY_TEXT.encoder.sourceLabel}
        placeholder={BODY_TEXT.encoder.placeholder}
        onChange={(event) => setSource(event.target.value)}
      />
      {outcome && <Notice tone={outcome.tone} edge="">{outcome.message}</Notice>}
    </section>
  )
}
