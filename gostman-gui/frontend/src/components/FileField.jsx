import { useRef, useState } from "react"
import { Paperclip } from "lucide-react"
import { Button } from "./ui/button"
import { MAX_ATTACHMENT_BYTES, readAttachment } from "../lib/attachments"
import { base64ByteLength } from "../lib/base64"
import { formatSize } from "../lib/dataUtils"

const SUMMARY = "min-w-0 flex-1 truncate text-xs"

const tooLargeMessage = (file) => (
  `${file.name} is ${formatSize(file.size)}. Files are limited to ${formatSize(MAX_ATTACHMENT_BYTES)}.`
)

function FileSummary({ fileName, data, error }) {
  if (error) return <span role="alert" title={error} className={`${SUMMARY} text-destructive`}>{error}</span>
  if (!fileName) return <span className={`${SUMMARY} text-muted-foreground`}>No file selected</span>
  const summary = `${fileName} (${formatSize(base64ByteLength(data))})`
  return <span title={summary} className={`${SUMMARY} font-mono text-foreground`}>{summary}</span>
}

export function FileField({ fileName, data, onChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState("")

  const handlePick = async (event) => {
    const file = event.target.files[0]
    event.target.value = ""
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(tooLargeMessage(file))
      return
    }
    setError("")
    onChange(await readAttachment(file))
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" onChange={handlePick} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current.click()}>
        <Paperclip />
        {fileName ? "Replace" : "Choose file"}
      </Button>
      <FileSummary fileName={fileName} data={data} error={error} />
    </div>
  )
}
