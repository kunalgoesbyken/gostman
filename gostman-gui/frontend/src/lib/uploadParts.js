const CONTENT_TYPE = 'content-type'
const CRLF = '\r\n'
const HEAD_END = CRLF + CRLF
const ESCAPE = '\\'
const QUOTE = '"'
const FALLBACK_FILE = 'file.bin'

const FORM_BOUNDARY = 'GostmanFormBoundary7MA4YWxkTrZu0gW'
export const DEFAULT_PART_TYPE = 'application/octet-stream'

export const isContentType = ({ key }) => key.toLowerCase() === CONTENT_TYPE

const describedPart = ({ name, value = '', file, contentType }) => (
  file === undefined ? { name, value } : { name, file: file || FALLBACK_FILE, contentType: contentType || DEFAULT_PART_TYPE }
)

export function uploadOf(prepared) {
  if (Array.isArray(prepared.parts)) return { parts: prepared.parts.map(describedPart) }
  return prepared.file !== undefined ? { file: prepared.file || FALLBACK_FILE } : {}
}

const escapeQuoted = (text) => text.replaceAll(ESCAPE, ESCAPE + ESCAPE).replaceAll(QUOTE, ESCAPE + QUOTE)

function partHead({ name, file, contentType }) {
  const disposition = `Content-Disposition: form-data; name="${escapeQuoted(name)}"`
  if (file === undefined) return `--${FORM_BOUNDARY}${CRLF}${disposition}${HEAD_END}`
  return `--${FORM_BOUNDARY}${CRLF}${disposition}; filename="${escapeQuoted(file)}"${CRLF}Content-Type: ${contentType}${HEAD_END}`
}

function joinText(segments) {
  return segments.reduce((joined, segment) => {
    const last = joined.at(-1)
    if (typeof segment === 'string' && typeof last === 'string') return [...joined.slice(0, -1), last + segment]
    return [...joined, segment]
  }, [])
}

export function formSegments(parts) {
  const pieces = parts.flatMap((part) => [partHead(part), part.file === undefined ? part.value : { file: part.file }, CRLF])
  return joinText([...pieces, `--${FORM_BOUNDARY}--${CRLF}`])
}

export const formContentType = () => `multipart/form-data; boundary=${FORM_BOUNDARY}`
