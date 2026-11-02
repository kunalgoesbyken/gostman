import { AlertTriangle, FileDigit } from "lucide-react"
import { HexView } from "./HexView"
import { TextBody } from "./TextBody"
import { EmptyState } from "./ui/emptyState"
import { SkeletonLines } from "./ui/skeleton"
import { BINARY_DONE, BINARY_FAILED, BINARY_TIMED_OUT, BINARY_TOO_LARGE } from "../hooks/useBinaryBody"
import { MAX_DECODE_BYTES } from "../lib/binary/limits"
import { formatBytes } from "../lib/byteSize"
import { RESPONSE_TEXT } from "../lib/responseText"

function BinaryProblem({ binary, view, response }) {
  if (binary.status === BINARY_FAILED) {
    return <EmptyState icon={AlertTriangle} title={RESPONSE_TEXT.decode.failed({ format: RESPONSE_TEXT.views[view], reason: binary.reason })} />
  }
  if (binary.status === BINARY_TIMED_OUT) {
    return <EmptyState icon={AlertTriangle} title={RESPONSE_TEXT.decode.timedOut({ format: RESPONSE_TEXT.views[view], seconds: binary.seconds })} />
  }
  if (binary.status === BINARY_TOO_LARGE) {
    return <EmptyState icon={FileDigit} title={RESPONSE_TEXT.decode.tooLarge({ size: formatBytes(response.size), limit: formatBytes(MAX_DECODE_BYTES) })} />
  }
  return <SkeletonLines label={RESPONSE_TEXT.decode.working} lines={4} />
}

export function BinaryViews({ response, view, binary, highlight }) {
  if (binary.status !== BINARY_DONE) return <BinaryProblem binary={binary} view={view} response={response} />
  if (view === 'hex') return <HexView bytes={binary.bytes} />
  return <TextBody text={binary.text} highlight={highlight} />
}
