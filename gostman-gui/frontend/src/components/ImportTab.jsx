import { useEffect, useMemo, useRef, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { ShareOpener } from "./ShareOpener"
import { formatSize, pluralize } from "../lib/dataUtils"
import { MAX_FILE_SIZE, parseImport } from "../lib/importExport"
import { SHARE_FILE_EXTENSION, findShareReference } from "../lib/share"
import { cn } from "../lib/utils"

const PARSE_DELAY_MS = 300
const ACCEPTED_FILES = `.json,.yaml,.yml,.${SHARE_FILE_EXTENSION}`
const READ_FAILURE = { success: false, error: "The file could not be read as text." }

const tooLarge = (file) => ({
  success: false,
  error: `${file.name} is ${formatSize(file.size)}. Files are limited to ${formatSize(MAX_FILE_SIZE)}.`,
})

function useParsedImport(text) {
  const [state, setState] = useState({ result: null, isParsing: false })

  useEffect(() => {
    if (text.trim() === "") {
      setState({ result: null, isParsing: false })
      return undefined
    }
    let isCurrent = true
    setState((current) => ({ ...current, isParsing: true }))
    const timer = setTimeout(async () => {
      const result = await parseImport(text)
      if (isCurrent) setState({ result, isParsing: false })
    }, PARSE_DELAY_MS)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [text])

  return state
}

function ImportSummary({ result, onImport }) {
  const warnings = result.warnings || []
  return (
    <div role="status" className="flex shrink-0 items-start gap-3 rounded-md border border-border p-3">
      <div className="max-h-32 min-w-0 flex-1 overflow-y-auto text-xs [overflow-wrap:anywhere]">
        <p className="font-medium text-foreground">
          {result.label}: {pluralize(result.requests.length, "request")} and {pluralize(result.folders.length, "folder")}
        </p>
        {warnings.map((warning) => (
          <p key={warning} className="pt-1 text-warning">{warning}</p>
        ))}
      </div>
      <Button size="sm" onClick={onImport}>Import</Button>
    </div>
  )
}

function ImportFailure({ error }) {
  return (
    <p role="alert" className="max-h-32 shrink-0 overflow-y-auto whitespace-pre-wrap rounded-md border border-border p-3 text-xs text-destructive [overflow-wrap:anywhere]">
      {error}
    </p>
  )
}

export function ImportTab({ onImport, onImportShared, onClose }) {
  const [text, setText] = useState("")
  const [fileFailure, setFileFailure] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const sharedReference = useMemo(() => findShareReference(text), [text])
  const { result, isParsing } = useParsedImport(sharedReference === null ? text : "")
  const shown = fileFailure || result

  const updateText = (next) => {
    setFileFailure(null)
    setText(next)
  }

  const readFile = async (file) => {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setFileFailure(tooLarge(file))
      return
    }
    try {
      updateText(await file.text())
    } catch {
      setFileFailure(READ_FAILURE)
    }
  }

  const handlePick = (event) => {
    readFile(event.target.files[0])
    event.target.value = ""
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragOver(false)
    readFile(event.dataTransfer.files[0])
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const confirmImport = () => {
    onImport(result)
    onClose()
  }

  return (
    <>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragOver(false)}
        className={cn(
          "flex shrink-0 items-center gap-3 rounded-md border border-dashed border-border p-3",
          isDragOver && "border-primary"
        )}
      >
        <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} onChange={handlePick} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current.click()}>
          <Upload />
          Choose file
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Drop a file here, or paste its contents below. Postman v2.1 collections, OpenAPI 3 specs (JSON or YAML), Gostman exports and Gostman share links or files, up to {formatSize(MAX_FILE_SIZE)}.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(event) => updateText(event.target.value)}
        placeholder="Paste a Postman collection, an OpenAPI spec, a Gostman export or a share link"
        aria-label="Content to import"
        className="min-h-24 flex-1"
      />

      {sharedReference !== null && (
        <div className="shrink-0 rounded-md border border-border p-3">
          <ShareOpener
            key={sharedReference}
            reference={sharedReference}
            onImport={onImportShared}
            onCancel={() => updateText("")}
            onDone={onClose}
          />
        </div>
      )}
      {isParsing && <p role="status" className="shrink-0 text-xs text-muted-foreground">Reading the content</p>}
      {!isParsing && shown && !shown.success && <ImportFailure error={shown.error} />}
      {!isParsing && shown?.success && <ImportSummary result={shown} onImport={confirmImport} />}
    </>
  )
}
