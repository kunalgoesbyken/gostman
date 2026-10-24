import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FileText, FolderOpen, Upload } from "lucide-react"
import { BrandIcon } from "./ui/brandIcon"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { ShareOpener } from "./ShareOpener"
import { parseImport } from "../lib/importExport"
import { droppedEntries, pickedEntries, readImportFiles } from "../lib/importerClient"
import { FORMAT_LABELS, IMPORT_FORMATS, IMPORT_TEXT } from "../lib/importText"
import { mayBeSpec } from "../lib/openapiSpec"
import { SHARE_FILE_EXTENSION, findShareReference } from "../lib/share"
import { SPEC_TEXT } from "../lib/specText"
import { cn } from "../lib/utils"
import { describeCounts } from "../lib/importCounts"
import { countImported } from "../lib/importSummary"

const PARSE_DELAY_MS = 300
const AUTO_FORMAT = "auto"
const SPEC_FORMAT = "openapi"
const HAR_FORMAT = "har"
const ACCEPTED_FILES = `.zip,.json,.yaml,.yml,.xml,.wsdl,.xsd,.har,.bru,.http,.rest,.${SHARE_FILE_EXTENSION}`

const totalsOf = (sources) => sources.reduce(
  (total, source) => ({
    requests: total.requests + source.requests,
    folders: total.folders + source.folders,
    environments: total.environments + source.environments,
  }),
  { requests: 0, folders: 0, environments: 0 },
)

function useParsedImport(source, readSource, options) {
  const [state, setState] = useState({ result: null, isParsing: false })

  useEffect(() => {
    if (!source) {
      setState({ result: null, isParsing: false })
      return undefined
    }
    let isCurrent = true
    setState((current) => ({ ...current, isParsing: true }))
    const timer = setTimeout(async () => {
      const result = await readSource(source, options)
      if (isCurrent) setState({ result, isParsing: false })
    }, PARSE_DELAY_MS)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [source, readSource, options])

  return state
}

function SourceLines({ sources }) {
  return (
    <>
      {sources.length > 1 && <p className="font-medium text-foreground">{IMPORT_TEXT.totalLine(sources.length, describeCounts(totalsOf(sources)))}</p>}
      {sources.map((source, index) => (
        <p key={`${source.name}-${index}`} className="pt-1 text-foreground">
          {IMPORT_TEXT.sourceLine(source.name, FORMAT_LABELS[source.format] || source.format, describeCounts(source))}
        </p>
      ))}
    </>
  )
}

function ImportSummary({ result, onImport, onBrowse }) {
  const warnings = result.warnings || []
  const skipped = result.skipped || []
  const isUnlinked = result.spec && !result.spec.source
  return (
    <div role="status" className="flex shrink-0 items-start gap-3 rounded-md border border-border p-3">
      <div className="max-h-40 min-w-0 flex-1 overflow-y-auto text-xs [overflow-wrap:anywhere]">
        {result.sources ? <SourceLines sources={result.sources} /> : (
          <p className="font-medium text-foreground">
            {result.label}: {describeCounts(countImported(result))}
          </p>
        )}
        {isUnlinked && <p className="pt-1 text-muted-foreground">{SPEC_TEXT.syncNote}</p>}
        {warnings.map((warning) => (
          <p key={warning} className="pt-1 text-warning">{warning}</p>
        ))}
        {skipped.length > 0 && <p className="pt-1 font-medium text-muted-foreground">{IMPORT_TEXT.skippedHeading}</p>}
        {skipped.map((note) => (
          <p key={note} className="text-muted-foreground">{note}</p>
        ))}
      </div>
      {result.spec && <Button size="sm" variant="outline" onClick={onBrowse}>{SPEC_TEXT.browse}</Button>}
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

function AddressRow({ address, onChange, onLoad, onPickFile }) {
  const submit = (event) => {
    event.preventDefault()
    onLoad()
  }
  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-2">
      <Input
        type="url"
        value={address}
        onChange={(event) => onChange(event.target.value)}
        placeholder={SPEC_TEXT.addressPlaceholder}
        aria-label={SPEC_TEXT.addressLabel}
        spellCheck={false}
      />
      <Button type="submit" variant="outline" size="sm" disabled={address.trim() === ""}>{SPEC_TEXT.load}</Button>
      {onPickFile && (
        <Button variant="outline" size="sm" onClick={onPickFile}>
          <FileText />
          {SPEC_TEXT.chooseSpecFile}
        </Button>
      )}
    </form>
  )
}

function FormatRow({ format, onFormat, showStatic, skipStatic, onSkipStatic }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-2 text-muted-foreground">
        {IMPORT_TEXT.formatLabel}
        <Select value={format} onChange={(event) => onFormat(event.target.value)} aria-label={IMPORT_TEXT.formatLabel} className="w-48">
          {IMPORT_FORMATS.map((option) => <option key={option.value} value={option.value} icon={<BrandIcon brand={option.value} />}>{option.label}</option>)}
        </Select>
      </label>
      {showStatic && (
        <label className="flex items-center gap-2 text-muted-foreground">
          <input type="checkbox" checked={skipStatic} onChange={(event) => onSkipStatic(event.target.checked)} />
          {IMPORT_TEXT.skipStatic}
        </label>
      )}
    </div>
  )
}

export function ImportTab({ openapi, importer, onPickSpecFile, onImport, onImportShared, onClose }) {
  const [text, setText] = useState("")
  const [fileName, setFileName] = useState("")
  const [files, setFiles] = useState([])
  const [address, setAddress] = useState("")
  const [remote, setRemote] = useState(null)
  const [fileFailure, setFileFailure] = useState(null)
  const [format, setFormat] = useState(AUTO_FORMAT)
  const [skipStatic, setSkipStatic] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const sharedReference = useMemo(() => findShareReference(text), [text])

  const source = useMemo(() => {
    if (remote) return { remote }
    if (files.length > 0) return { files }
    if (sharedReference === null && text.trim() !== "") return { text, name: fileName || IMPORT_TEXT.pastedName }
    return null
  }, [remote, files, sharedReference, text, fileName])

  const options = useMemo(() => ({ format, skipStatic }), [format, skipStatic])

  const readSource = useCallback(async (input, chosen) => {
    const importOptions = { skipStatic: chosen.skipStatic }
    if (input.remote) return openapi.read(input.remote)
    if (input.files) return importer.read(input.files, chosen.format, importOptions)
    const mayUseSpec = chosen.format === AUTO_FORMAT || chosen.format === SPEC_FORMAT
    if (mayUseSpec && mayBeSpec(input.text)) return openapi.read({ text: input.text })
    const local = chosen.format === AUTO_FORMAT ? await parseImport(input.text) : { success: false }
    if (local.success) return local
    return importer.read([{ name: input.name, text: input.text }], chosen.format, importOptions)
  }, [openapi, importer])

  const { result, isParsing } = useParsedImport(source, readSource, options)
  const shown = fileFailure || result
  const showStatic = format === HAR_FORMAT || result?.sources?.some((entry) => entry.format === HAR_FORMAT)

  const reset = () => {
    setFileFailure(null)
    setRemote(null)
    setFiles([])
    setFileName("")
  }

  const updateText = (next) => {
    reset()
    setText(next)
  }

  const loadAddress = () => {
    updateText("")
    setRemote({ url: address.trim() })
  }

  const pickSpecFile = async () => {
    const path = await onPickSpecFile(SPEC_TEXT.chooseSpecFile)
    if (!path) return
    updateText("")
    setRemote({ path })
  }

  const readEntries = async (entries) => {
    if (entries.length === 0) return
    reset()
    const read = await readImportFiles(entries)
    if (read.error) {
      setFileFailure({ success: false, error: read.error })
      return
    }
    if (read.files.length === 1) {
      setText(read.files[0].text)
      setFileName(read.files[0].name)
      return
    }
    setText("")
    setFiles(read.files)
  }

  const handlePick = (event) => {
    readEntries(pickedEntries(event.target.files))
    event.target.value = ""
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setIsDragOver(false)
    readEntries(await droppedEntries(event.dataTransfer))
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const confirmImport = () => {
    if (result.spec) openapi.importSpec(result)
    else onImport(result)
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
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_FILES} onChange={handlePick} className="hidden" />
        <input ref={folderInputRef} type="file" webkitdirectory="" onChange={handlePick} className="hidden" />
        <div className="flex shrink-0 flex-col gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current.click()}>
            <Upload />
            {IMPORT_TEXT.chooseFiles}
          </Button>
          <Button variant="outline" size="sm" onClick={() => folderInputRef.current.click()}>
            <FolderOpen />
            {IMPORT_TEXT.chooseFolder}
          </Button>
        </div>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          {files.length > 0 ? IMPORT_TEXT.filesSelected(files.length) : IMPORT_TEXT.dropHint}
        </p>
      </div>

      <FormatRow format={format} onFormat={setFormat} showStatic={showStatic} skipStatic={skipStatic} onSkipStatic={setSkipStatic} />

      <AddressRow address={address} onChange={setAddress} onLoad={loadAddress} onPickFile={onPickSpecFile ? pickSpecFile : null} />

      <Textarea
        value={text}
        onChange={(event) => updateText(event.target.value)}
        placeholder={IMPORT_TEXT.pastePlaceholder}
        aria-label={IMPORT_TEXT.pasteLabel}
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
      {isParsing && <p role="status" className="shrink-0 text-xs text-muted-foreground">{IMPORT_TEXT.reading}</p>}
      {!isParsing && shown && !shown.success && <ImportFailure error={shown.error} />}
      {!isParsing && shown?.success && (
        <ImportSummary result={shown} onImport={confirmImport} onBrowse={() => openapi.browse(remote || { text })} />
      )}
    </>
  )
}
