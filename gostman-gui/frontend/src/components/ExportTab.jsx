import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { CopyTextButton } from "./CopyTextButton"
import { DEFAULT_DOCS_OPTIONS, DocsOptions } from "./DocsOptions"
import { Button } from "./ui/button"
import { SegmentedControl } from "./ui/segmented"
import { pluralize } from "../lib/dataUtils"
import { buildDocs } from "../lib/docs"
import { EXPORT_TEXT } from "../lib/importText"
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

const toJSON = (value) => JSON.stringify(value, null, 2)

const EXPORT_FORMATS = [
  {
    value: "gostman",
    label: "Gostman",
    description: "Full backup: requests, folders and every environment",
    extension: "json",
    mime: JSON_MIME,
    build: ({ requests, folders, environments }) => toJSON(exportToGostman(requests, folders, environments)),
  },
  {
    value: "postman",
    label: "Postman",
    description: "Collection v2.1 with the active environment as collection variables",
    extension: "postman_collection.json",
    mime: JSON_MIME,
    build: ({ requests, folders, variables }) => toJSON(exportToPostman(requests, folders, { variables })),
  },
  {
    value: "openapi-json",
    label: "OpenAPI JSON",
    description: "OpenAPI 3.0 description of the HTTP requests",
    extension: "openapi.json",
    mime: JSON_MIME,
    build: ({ requests }) => exportToOpenAPIJSON(requests),
  },
  {
    value: "openapi-yaml",
    label: "OpenAPI YAML",
    description: "OpenAPI 3.0 description of the HTTP requests",
    extension: "openapi.yaml",
    mime: "text/yaml",
    build: ({ requests }) => exportToOpenAPIYAML(requests),
  },
  {
    value: "markdown",
    label: "Markdown",
    description: "Readable API documentation",
    extension: "md",
    mime: "text/markdown",
    build: ({ requests, folders }) => exportToMarkdown(requests, folders),
  },
  {
    value: "html",
    label: "HTML docs",
    description: "One self-contained page to publish or print. Credentials are left out and variables stay as {{name}}",
    fileName: "api-docs.html",
    mime: "text/html",
    hasDocsOptions: true,
    build: ({ requests, folders, docsOptions }) => buildDocs({ requests, folders }, docsOptions),
  },
]

const BACKEND_FORMATS = [
  { value: "bruno", label: "Bruno", description: "A folder of .bru files with environments, saved as a .zip", mime: "application/zip", backend: "bruno" },
  { value: "curl", label: "curl script", description: "One curl command per request. Credentials become environment variable placeholders", fileName: "requests.sh", mime: "text/x-shellscript", backend: "curl" },
  { value: "har", label: "HAR", description: "HTTP Archive 1.2 with the requests and no responses", fileName: "requests.har", mime: JSON_MIME, backend: "har" },
]

const NEWLINE = String.fromCharCode(10)

const previewOf = (files) => (
  files.length === 1 ? files[0].text : files.map((file) => [EXPORT_TEXT.fileHeading(file.name), file.text].join(NEWLINE)).join(NEWLINE + NEWLINE)
)

function useBackendExport(format, data, importer, includeSecrets) {
  const [state, setState] = useState({ reply: null, error: "", isBuilding: false })
  const { requests, folders, environments, variables } = data

  useEffect(() => {
    if (!format.backend) return undefined
    let isCurrent = true
    setState((current) => ({ ...current, isBuilding: true }))
    const collection = { requests, folders, environments, variables: JSON.stringify(variables || {}) }
    importer.build(format.backend, collection, { includeSecrets })
      .then((reply) => isCurrent && setState({ reply, error: "", isBuilding: false }))
      .catch((error) => isCurrent && setState({ reply: null, error: error.message, isBuilding: false }))
    return () => {
      isCurrent = false
    }
  }, [format, requests, folders, environments, variables, importer, includeSecrets])

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

export function ExportTab({ requests, folders, environments, variables, importer, onSaveFile, onSaveBase64 }) {
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].value)
  const [docsOptions, setDocsOptions] = useState(DEFAULT_DOCS_OPTIONS)
  const [includeSecrets, setIncludeSecrets] = useState(false)

  const format = ALL_FORMATS.find((candidate) => candidate.value === formatId)
  const local = useMemo(
    () => (format.backend ? { content: "", error: "" } : buildExport(format, { requests, folders, environments, variables, docsOptions })),
    [format, requests, folders, environments, variables, docsOptions]
  )
  const remote = useBackendExport(format, { requests, folders, environments, variables }, importer, includeSecrets)
  const content = format.backend ? (remote.reply ? previewOf(remote.reply.files) : "") : local.content
  const error = format.backend ? remote.error : local.error
  const save = () => {
    if (remote.reply?.archive) onSaveBase64("gostman-export.zip", remote.reply.archive, format.mime)
    else if (format.backend) onSaveFile(format.fileName, remote.reply.files[0].text, format.mime)
    else onSaveFile(format.fileName || `${FILE_BASE_NAME}.${format.extension}`, content, format.mime)
  }
  const preview = content.length > PREVIEW_LIMIT ? `${content.slice(0, PREVIEW_LIMIT)}\n…` : content

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SegmentedControl label="Export format" options={ALL_FORMATS} value={formatId} onChange={setFormatId} className="shrink" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CopyTextButton text={content} />
          <Button size="sm" onClick={save} disabled={!content || remote.isBuilding}>
            <Download />
            Save file
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
        {format.description}. This workspace has {pluralize(requests.length, "request")}, {pluralize(folders.length, "folder")} and {pluralize(environments.length, "environment")}.
      </p>

      {error ? (
        <p role="alert" className="text-xs text-destructive [overflow-wrap:anywhere]">Could not build the export: {error}</p>
      ) : (
        <pre
          aria-label="Export preview"
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-md border border-border p-3 font-mono text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]"
        >
          {preview}
        </pre>
      )}
    </>
  )
}
