import { Suspense, useMemo } from "react"
import { FileField } from "./FileField"
import { KeyValueEditor } from "./KeyValueEditor"
import {
  BODY_BINARY,
  BODY_FORM,
  BODY_JSON,
  BODY_MULTIPART,
  BODY_NONE,
  BODY_TYPES,
  BODY_XML,
  switchBodyType,
} from "../lib/body"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { isPlainObject, parseJSON } from "../lib/dataUtils"
import { parseRows, serializeRows } from "../lib/rows"
import { cn } from "../lib/utils"

const PLAIN_TEXT_LANGUAGE = "plaintext"
const EDITOR_LANGUAGES = { [BODY_JSON]: "json", [BODY_XML]: "xml" }

function TypeSelector({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Body type" className="flex flex-wrap items-center gap-1 border-b border-border/50 px-4 py-2">
      {BODY_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          role="radio"
          aria-checked={type.value === value}
          onClick={() => onChange(type.value)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            type.value === value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  )
}

function RowsBody({ body, typed, onChange }) {
  const rows = useMemo(() => parseRows(body), [body])
  return <KeyValueEditor rows={rows} typed={typed} onChange={(next) => onChange(serializeRows(next))} />
}

function BinaryBody({ body, onChange }) {
  const stored = useMemo(() => parseJSON(body, EMPTY_ATTACHMENT), [body])
  const file = isPlainObject(stored) ? { ...EMPTY_ATTACHMENT, ...stored } : EMPTY_ATTACHMENT
  return (
    <div className="px-4 py-3">
      <FileField
        fileName={file.fileName}
        data={file.data}
        onChange={(attachment) => onChange(JSON.stringify(attachment))}
      />
    </div>
  )
}

function RawBody({ body, bodyType, editorPath, onChange, EditorComponent }) {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading editor...</p>}>
      <EditorComponent
        value={body}
        onChange={(event) => onChange(event.target.value)}
        language={EDITOR_LANGUAGES[bodyType] || PLAIN_TEXT_LANGUAGE}
        path={editorPath}
        height="100%"
      />
    </Suspense>
  )
}

function BodyEditor({ request, editorPath, onChange, EditorComponent }) {
  const { body, bodyType } = request
  if (bodyType === BODY_NONE) return <p className="px-4 py-3 text-xs text-muted-foreground">This request is sent without a body.</p>
  if (bodyType === BODY_FORM) return <RowsBody body={body} onChange={onChange} />
  if (bodyType === BODY_MULTIPART) return <RowsBody body={body} typed onChange={onChange} />
  if (bodyType === BODY_BINARY) return <BinaryBody body={body} onChange={onChange} />
  return <RawBody body={body} bodyType={bodyType} editorPath={editorPath} onChange={onChange} EditorComponent={EditorComponent} />
}

export function BodyPanel({ request, drafts, editorPath, replacedByGraphQL, onUpdateRequest, onDraftsChange, EditorComponent }) {
  const handleTypeChange = (bodyType) => {
    const next = switchBodyType(request, drafts, bodyType)
    onDraftsChange(next.drafts)
    onUpdateRequest(next.updates)
  }

  return (
    <div className="flex h-full flex-col">
      <TypeSelector value={request.bodyType} onChange={handleTypeChange} />
      {replacedByGraphQL && (
        <p className="border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
          The method is GRAPHQL, so the body is built from the GraphQL tab and this one is not sent.
        </p>
      )}
      <div className="min-h-0 flex-1">
        <BodyEditor
          request={request}
          editorPath={editorPath}
          onChange={(body) => onUpdateRequest({ body })}
          EditorComponent={EditorComponent}
        />
      </div>
    </div>
  )
}
