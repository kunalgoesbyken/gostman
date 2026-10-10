import { useRef, useState } from "react"
import { Paperclip } from "lucide-react"
import { Button } from "./ui/button"
import { MAX_ATTACHMENT_BYTES, readAttachment } from "../lib/attachments"
import { base64ByteLength } from "../lib/base64"
import { formatSize } from "../lib/dataUtils"

const tooLargeMessage = (file) => (
  `${file.name} is ${formatSize(file.size)}. Files are limited to ${formatSize(MAX_ATTACHMENT_BYTES)}.`
)

function FileSummary({ fileName, data, error }) {
  if (error) return <span role="alert" className="truncate text-xs text-destructive">{error}</span>
  if (!fileName) return <span className="truncate text-xs text-muted-foreground">No file selected</span>
  return (
    <span className="truncate font-mono text-xs text-foreground/90">
      {fileName}
      <span className="ml-2 text-muted-foreground">{formatSize(base64ByteLength(data))}</span>
    </span>
  )
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-2"
        onClick={() => inputRef.current.click()}
      >
        <Paperclip />
        {fileName ? "Replace" : "Choose file"}
      </Button>
      <FileSummary fileName={fileName} data={data} error={error} />
    </div>
  )
}
