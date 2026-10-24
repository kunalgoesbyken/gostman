import { useRef, useState } from "react"
import { Paperclip } from "lucide-react"
import { Button } from "./ui/button"
import { canAttachFromDisk, maxAttachmentBytes, pickAttachment, readAttachment } from "../lib/attachments"
import { ATTACHMENT_TEXT } from "../lib/attachmentText"
import { base64ByteLength } from "../lib/base64"
import { formatSize } from "../lib/dataUtils"

const SUMMARY = "min-w-0 flex-1 truncate text-xs"

function FileSummary({ fileName, data, path }) {
  if (!fileName) return <span className={`${SUMMARY} text-muted-foreground`}>{ATTACHMENT_TEXT.none}</span>
  if (path) return <span title={ATTACHMENT_TEXT.fromDisk(path)} className={`${SUMMARY} font-mono text-foreground`}>{fileName}</span>
  const summary = `${fileName} (${formatSize(base64ByteLength(data))})`
  return <span title={summary} className={`${SUMMARY} font-mono text-foreground`}>{summary}</span>
}

function useFilePicker(onChange) {
  const inputRef = useRef(null)
  const [error, setError] = useState("")

  const handleInput = async (event) => {
    const file = event.target.files[0]
    event.target.value = ""
    if (!file) return
    const limit = maxAttachmentBytes()
    if (file.size > limit) {
      setError(ATTACHMENT_TEXT.tooLarge(file.name, formatSize(file.size), formatSize(limit)))
      return
    }
    setError("")
    onChange(await readAttachment(file))
  }

  const choose = async () => {
    if (!canAttachFromDisk()) {
      inputRef.current.click()
      return
    }
    const attachment = await pickAttachment(ATTACHMENT_TEXT.pickTitle)
    if (!attachment) return
    setError("")
    onChange(attachment)
  }

  return { inputRef, error, handleInput, choose }
}

export function FileField({ fileName, data, path, onChange }) {
  const { inputRef, error, handleInput, choose } = useFilePicker(onChange)

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <input ref={inputRef} type="file" className="hidden" onChange={handleInput} />
        <Button variant="outline" size="sm" onClick={choose}>
          <Paperclip />
          {fileName ? ATTACHMENT_TEXT.replace : ATTACHMENT_TEXT.choose}
        </Button>
        <FileSummary fileName={fileName} data={data} path={path} />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
