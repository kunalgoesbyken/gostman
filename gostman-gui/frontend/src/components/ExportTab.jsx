import { useEffect, useMemo, useState } from "react"
import { Download, TriangleAlert } from "lucide-react"
import { CopyTextButton } from "./CopyTextButton"
import { DEFAULT_DOCS_OPTIONS, DocsOptions } from "./DocsOptions"
import { ScanNotice } from "./ScanNotice"
import { Button } from "./ui/button"
import { SegmentedControl } from "./ui/segmented"
import { useSecretScan } from "../hooks/useSecretScan"
import { SCAN_TEXT } from "../lib/scanText"
import { buildDocs } from "../lib/docs"
import { EXPORT_TEXT } from "../lib/importText"
import { noteExport } from "../lib/exportReminder"
import { cn } from "../lib/utils"
import {
  exportToGostman,
  exportToMarkdown,
  exportToOpenAPIJSON,
  exportToOpenAPIYAML,
  exportToPostman,
} from "../lib/importExport"

const PREVIEW_LIMIT = 20000
const FILE_BASE_NAME = "gostman-export"
const JSON_MIME = "application/json"
const ZIP_MIME = "application/zip"
const BACKUP_FORMAT = "gostman"

const toJSON = (value) => JSON.stringify(value, null, 2)

const EXPORT_FORMATS = [
  {
    value: BACKUP_FORMAT,
    ...EXPORT_TEXT.formats.gostman,
    extension: "json",
    mime: JSON_MIME,
    build: ({ requests, folders, environments, settings, collectionVariables, sharedOrder }) => toJSON(exportToGostman(requests, folders, environments, settings, collectionVariables, sharedOrder)),
  },
  {
    value: "postman",
    ...EXPORT_TEXT.formats.postman,
    extension: "postman_collection.json",
    mime: JSON_MIME,
    adapt: "postman",
    build: ({ requests, folders, variables, settings, sharedOrder }) => toJSON(exportToPostman(requests, folders, { variables, settings, sharedOrder })),
  },
  {
    value: "openapi-json",
    ...EXPORT_TEXT.formats.openapiJson,
    extension: "openapi.json",
    mime: JSON_MIME,
    build: ({ requests }) => exportToOpenAPIJSON(requests),
  },
  {
    value: "openapi-yaml",
    ...EXPORT_TEXT.formats.openapiYaml,
    extension: "openapi.yaml",
    mime: "text/yaml",
    build: ({ requests }) => exportToOpenAPIYAML(requests),
  },
  {
    value: "markdown",
    ...EXPORT_TEXT.formats.markdown,
    extension: "md",
    mime: "text/markdown",
    build: ({ requests, folders }) => exportToMarkdown(requests, folders),
  },
  {
    value: "html",
    ...EXPORT_TEXT.formats.html,
    fileName: "api-docs.html",
    mime: "text/html",
    hasDocsOptions: true,
    build: ({ requests, folders, settings, docsOptions }) => buildDocs({ requests, folders, settings }, docsOptions),
  },
]

const BACKEND_FORMATS = [
  { value: "bruno", ...EXPORT_TEXT.formats.bruno, mime: ZIP_MIME, backend: "bruno" },
  { value: "curl", ...EXPORT_TEXT.formats.curl, fileName: "requests.sh", mime: "text/x-shellscript", backend: "curl" },
  { value: "har", ...EXPORT_TEXT.formats.har, fileName: "requests.har", mime: JSON_MIME, backend: "har" },
  { value: "http", ...EXPORT_TEXT.formats.http, fileName: "requests.http", mime: "text/plain", backend: "http" },
]

const NEWLINE = String.fromCharCode(10)

const previewOf = (files) => (
  files.length === 1 ? files[0].text : files.map((file) => [EXPORT_TEXT.fileHeading(file.name), file.text].join(NEWLINE)).join(NEWLINE + NEWLINE)
)

const toCollection = ({ requests, folders, environments, variables, settings, sharedOrder }) => (
  { requests, folders, environments, settings, variables: JSON.stringify(variables || {}), sharedOrder }
)

const NOT_ADAPTED = { adapted: null, notes: [], warnings: [], isAdapting: false }

function useAdaptedScripts(format, data, importer) {
  const [state, setState] = useState(NOT_ADAPTED)

  useEffect(() => {
    if (!format.adapt) {
      setState(NOT_ADAPTED)
      return undefined
    }
    let isCurrent = true
    setState((current) => ({ ...current, isAdapting: true }))
    importer.adapt(format.adapt, toCollection(data))
      .then(({ collection, notes, warnings }) => isCurrent && setState({
        adapted: { ...data, requests: collection.requests, folders: collection.folders, settings: collection.settings },
        notes: notes || [],
        warnings: warnings || [],
        isAdapting: false,
      }))
      .catch((error) => isCurrent && setState({ adapted: data, notes: [], warnings: [EXPORT_TEXT.adaptFailed(error.message)], isAdapting: false }))
    return () => {
      isCurrent = false
    }
  }, [format, data, importer])

  return state
}

function ExportReport({ notes, warnings, tool }) {
  if (notes.length === 0 && warnings.length === 0) return null
  const hasWarnings = warnings.length > 0
  return (
    <section
      role="status"
      aria-label={EXPORT_TEXT.reportLabel}
      className={cn(
        "flex shrink-0 flex-col gap-2 rounded-md border p-3 text-xs [overflow-wrap:anywhere]",
        hasWarnings ? "border-warning/40" : "border-border"
      )}
    >
      {hasWarnings && (
        <div className="flex flex-col gap-1.5">
          <h3 className="flex items-center gap-1.5 font-medium text-foreground">
            <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
            {EXPORT_TEXT.checkHeading(warnings.length, tool)}
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-foreground marker:text-warning">
            {warnings.map((warning, index) => <li key={index}>{warning}</li>)}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <div className={cn("flex flex-col gap-1 text-muted-foreground", hasWarnings && "border-t border-border pt-2")}>
          <h3 className="font-medium">{EXPORT_TEXT.changedHeading(tool)}</h3>
          <ul className="flex flex-col gap-0.5">
            {notes.map((note, index) => <li key={index}>{note}</li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

function useBackendExport(format, data, importer, includeSecrets) {
  const [state, setState] = useState({ reply: null, error: "", isBuilding: false })

  useEffect(() => {
    if (!format.backend) return undefined
    let isCurrent = true
    setState((current) => ({ ...current, isBuilding: true }))
    importer.build(format.backend, toCollection(data), { includeSecrets })
      .then((reply) => isCurrent && setState({ reply, error: "", isBuilding: false }))
      .catch((error) => isCurrent && setState({ reply: null, error: error.message, isBuilding: false }))
    return () => {
      isCurrent = false
    }
  }, [format, data, importer, includeSecrets])

  return state
}

const ALL_FORMATS = [...EXPORT_FORMATS, ...BACKEND_FORMATS]

function buildExport(format, data) {
  try {
    return { content: format.build(data), error: "" }
  } catch (error) {
    return { content: "", error: error?.message || String(error) }
  }
}

export function ExportTab({ requests, folders, environments, collectionVariables, variables, settings, sharedOrder, importer, scan, onGoToRequest, onSaveFile, onSaveBase64 }) {
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].value)
  const scanned = useMemo(
    () => ({ requests, folders, environments, variables: collectionVariables?.variables, settings }),
    [requests, folders, environments, collectionVariables, settings]
  )
  const scanState = useSecretScan(scan, scanned, false)
  const [docsOptions, setDocsOptions] = useState(DEFAULT_DOCS_OPTIONS)
  const [includeSecrets, setIncludeSecrets] = useState(false)

  const format = ALL_FORMATS.find((candidate) => candidate.value === formatId)
  const data = useMemo(
    () => ({ requests, folders, environments, collectionVariables, variables, settings, sharedOrder }),
    [requests, folders, environments, collectionVariables, variables, settings, sharedOrder]
  )
  const scripts = useAdaptedScripts(format, data, importer)
  const source = format.adapt ? scripts.adapted : data
  const local = useMemo(
    () => (format.backend || !source ? { content: "", error: "" } : buildExport(format, { ...source, docsOptions })),
    [format, source, docsOptions]
  )
  const remote = useBackendExport(format, data, importer, includeSecrets)
  const content = format.backend ? (remote.reply ? previewOf(remote.reply.files) : "") : local.content
  const error = format.backend ? remote.error : local.error
  const report = format.backend ? { notes: remote.reply?.notes || [], warnings: remote.reply?.warnings || [] } : scripts
  const save = () => {
    if (remote.reply?.archive) onSaveBase64("gostman-export.zip", remote.reply.archive, ZIP_MIME)
    else if (format.backend) onSaveFile(format.fileName, remote.reply.files[0].text, format.mime)
    else onSaveFile(format.fileName || `${FILE_BASE_NAME}.${format.extension}`, content, format.mime)
    if (format.value === BACKUP_FORMAT) noteExport()
  }
  const preview = content.length > PREVIEW_LIMIT ? `${content.slice(0, PREVIEW_LIMIT)}\n…` : content

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SegmentedControl label={EXPORT_TEXT.formatLabel} options={ALL_FORMATS} value={formatId} onChange={setFormatId} />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CopyTextButton text={content} />
          <Button size="sm" onClick={save} disabled={!content || remote.isBuilding || scripts.isAdapting}>
            <Download />
            {EXPORT_TEXT.saveFile}
          </Button>
        </div>
      </div>

      {format.backend && (
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={includeSecrets} onChange={(event) => setIncludeSecrets(event.target.checked)} />
          {EXPORT_TEXT.includeSecrets}
          <span>{includeSecrets ? EXPORT_TEXT.secretsWarning : EXPORT_TEXT.secretsNote}</span>
        </label>
      )}

      {format.hasDocsOptions && <DocsOptions options={docsOptions} onChange={setDocsOptions} />}

      <p className="shrink-0 text-xs text-muted-foreground">
        {EXPORT_TEXT.summary(format.description, { requests, folders, environments })}
      </p>

      <ExportReport notes={report.notes} warnings={report.warnings} tool={format.label} />

      <ScanNotice state={scanState} advice={SCAN_TEXT.foundExport} onGoToRequest={onGoToRequest} />

      {error ? (
        <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">{EXPORT_TEXT.failed(error)}</p>
      ) : (
        <pre
          aria-label={EXPORT_TEXT.previewLabel}
          className="min-h-48 flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-md border border-border p-3 font-mono text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]"
        >
          {preview}
        </pre>
      )}
    </>
  )
}
