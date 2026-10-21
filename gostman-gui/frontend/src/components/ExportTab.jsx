import { useMemo, useState } from "react"
import { Download } from "lucide-react"
import { CopyTextButton } from "./CopyTextButton"
import { DEFAULT_DOCS_OPTIONS, DocsOptions } from "./DocsOptions"
import { Button } from "./ui/button"
import { SegmentedControl } from "./ui/segmented"
import { pluralize } from "../lib/dataUtils"
import { buildDocs } from "../lib/docs"
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
    build: ({ requests, folders, environments, settings }) => toJSON(exportToGostman(requests, folders, environments, settings)),
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
    build: ({ requests, folders, settings, docsOptions }) => buildDocs({ requests, folders, settings }, docsOptions),
  },
]

function buildExport(format, data) {
  try {
    return { content: format.build(data), error: "" }
  } catch (error) {
    return { content: "", error: error?.message || String(error) }
  }
}

export function ExportTab({ requests, folders, environments, variables, settings, onSaveFile }) {
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].value)
  const [docsOptions, setDocsOptions] = useState(DEFAULT_DOCS_OPTIONS)

  const format = EXPORT_FORMATS.find((candidate) => candidate.value === formatId)
  const { content, error } = useMemo(
    () => buildExport(format, { requests, folders, environments, variables, settings, docsOptions }),
    [format, requests, folders, environments, variables, settings, docsOptions]
  )
  const preview = content.length > PREVIEW_LIMIT ? `${content.slice(0, PREVIEW_LIMIT)}\n…` : content

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <SegmentedControl label="Export format" options={EXPORT_FORMATS} value={formatId} onChange={setFormatId} className="shrink" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CopyTextButton text={content} />
          <Button
            size="sm"
            onClick={() => onSaveFile(format.fileName || `${FILE_BASE_NAME}.${format.extension}`, content, format.mime)}
            disabled={!content}
          >
            <Download />
            Save file
          </Button>
        </div>
      </div>

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
