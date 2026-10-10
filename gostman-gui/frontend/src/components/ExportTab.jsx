import { useMemo, useState } from "react"
import { Check, Copy, Download } from "lucide-react"
import { Button } from "./ui/button"
import { pluralize } from "../lib/dataUtils"
import {
  exportToGostman,
  exportToMarkdown,
  exportToOpenAPIJSON,
  exportToOpenAPIYAML,
  exportToPostman,
} from "../lib/importExport"
import { cn } from "../lib/utils"

const PREVIEW_LIMIT = 20000
const COPIED_NOTICE_MS = 2000
const FILE_BASE_NAME = "gostman-export"
const JSON_MIME = "application/json"

const toJSON = (value) => JSON.stringify(value, null, 2)

const EXPORT_FORMATS = [
  {
    id: "gostman",
    label: "Gostman",
    description: "Full backup: requests, folders and every environment",
    extension: "json",
    mime: JSON_MIME,
    build: ({ requests, folders, environments }) => toJSON(exportToGostman(requests, folders, environments)),
  },
  {
    id: "postman",
    label: "Postman",
    description: "Collection v2.1 with the active environment as collection variables",
    extension: "postman_collection.json",
    mime: JSON_MIME,
    build: ({ requests, folders, variables }) => toJSON(exportToPostman(requests, folders, { variables })),
  },
  {
    id: "openapi-json",
    label: "OpenAPI JSON",
    description: "OpenAPI 3.0 description of the HTTP requests",
    extension: "openapi.json",
    mime: JSON_MIME,
    build: ({ requests }) => exportToOpenAPIJSON(requests),
  },
  {
    id: "openapi-yaml",
    label: "OpenAPI YAML",
    description: "OpenAPI 3.0 description of the HTTP requests",
    extension: "openapi.yaml",
    mime: "text/yaml",
    build: ({ requests }) => exportToOpenAPIYAML(requests),
  },
  {
    id: "markdown",
    label: "Markdown",
    description: "Readable API documentation",
    extension: "md",
    mime: "text/markdown",
    build: ({ requests, folders }) => exportToMarkdown(requests, folders),
  },
]

function buildExport(format, data) {
  try {
    return { content: format.build(data), error: "" }
  } catch (error) {
    return { content: "", error: error?.message || String(error) }
  }
}

export function ExportTab({ requests, folders, environments, variables, onSaveFile }) {
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].id)
  const [copied, setCopied] = useState(false)

  const format = EXPORT_FORMATS.find((candidate) => candidate.id === formatId)
  const { content, error } = useMemo(
    () => buildExport(format, { requests, folders, environments, variables }),
    [format, requests, folders, environments, variables]
  )
  const preview = content.length > PREVIEW_LIMIT ? `${content.slice(0, PREVIEW_LIMIT)}\n…` : content

  const copy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_NOTICE_MS)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Export format">
        {EXPORT_FORMATS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={candidate.id === formatId}
            onClick={() => setFormatId(candidate.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              candidate.id === formatId
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted-foreground">
          {format.description}. {pluralize(requests.length, "request")}, {pluralize(folders.length, "folder")}, {pluralize(environments.length, "environment")} in this workspace.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" onClick={copy} disabled={!content} className="h-8 gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            size="sm"
            onClick={() => onSaveFile(`${FILE_BASE_NAME}.${format.extension}`, content, format.mime)}
            disabled={!content}
            className="h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Save file
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Could not build the export: {error}
        </p>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed scrollbar-compact">
          <code className="whitespace-pre-wrap break-words font-mono text-foreground">{preview}</code>
        </pre>
      )}
    </div>
  )
}
