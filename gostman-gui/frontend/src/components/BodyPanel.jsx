import { Suspense, useMemo } from "react"
import { FileX } from "lucide-react"
import { EmptyState } from "./ui/emptyState"
import { Notice, Panel, PanelBody, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { EditorSkeleton } from "./ui/skeleton"
import { FileField } from "./FileField"
import { SoapBar } from "./SoapBar"
import { KeyValueEditor } from "./KeyValueEditor"
import {
  BODY_BINARY,
  BODY_FORM,
  BODY_JSON,
  BODY_MULTIPART,
  BODY_NONE,
  BODY_SOAP,
  BODY_TYPES,
  BODY_XML,
  switchBodyType,
} from "../lib/body"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { isPlainObject, lookup, parseJSON } from "../lib/dataUtils"
import { parseRows, serializeRows } from "../lib/rows"
import { SOAP_11, soapTemplate } from "../lib/soap"

const PLAIN_TEXT_LANGUAGE = "plaintext"
const EDITOR_LANGUAGES = { [BODY_JSON]: "json", [BODY_XML]: "xml", [BODY_SOAP]: "xml" }

function RowsBody({ body, typed, onChange }) {
  const rows = useMemo(() => parseRows(body), [body])
  return <KeyValueEditor rows={rows} typed={typed} onChange={(next) => onChange(serializeRows(next))} />
}

function BinaryBody({ body, onChange }) {
  const stored = useMemo(() => parseJSON(body, EMPTY_ATTACHMENT), [body])
  const file = isPlainObject(stored) ? { ...EMPTY_ATTACHMENT, ...stored } : EMPTY_ATTACHMENT
  return (
    <PanelBody>
      <FileField
        fileName={file.fileName}
        data={file.data}
        onChange={(attachment) => onChange(JSON.stringify(attachment))}
      />
    </PanelBody>
  )
}

function RawBody({ body, bodyType, editorPath, onChange, EditorComponent }) {
  return (
    <div className="min-h-0 flex-1">
      <Suspense fallback={<EditorSkeleton />}>
        <EditorComponent
          value={body}
          onChange={(event) => onChange(event.target.value)}
          language={lookup(EDITOR_LANGUAGES, bodyType) || PLAIN_TEXT_LANGUAGE}
          path={editorPath}
          variables
          height="100%"
        />
      </Suspense>
    </div>
  )
}

function BodyEditor({ request, editorPath, onChange, EditorComponent }) {
  const { body, bodyType } = request
  if (bodyType === BODY_NONE) {
    return (
      <PanelBody>
        <EmptyState icon={FileX} title="No body" description="This request is sent without a body." />
      </PanelBody>
    )
  }
  if (bodyType === BODY_FORM) return <RowsBody body={body} onChange={onChange} />
  if (bodyType === BODY_MULTIPART) return <RowsBody body={body} typed onChange={onChange} />
  if (bodyType === BODY_BINARY) return <BinaryBody body={body} onChange={onChange} />
  return <RawBody body={body} bodyType={bodyType} editorPath={editorPath} onChange={onChange} EditorComponent={EditorComponent} />
}

export function BodyPanel({ request, drafts, editorPath, replacedByGraphQL, onUpdateRequest, onDraftsChange, EditorComponent }) {
  const handleTypeChange = (bodyType) => {
    const next = switchBodyType(request, drafts, bodyType)
    const body = next.updates.body ?? request.body
    onDraftsChange(next.drafts)
    onUpdateRequest(bodyType === BODY_SOAP && body.trim() === "" ? { ...next.updates, body: soapTemplate(SOAP_11) } : next.updates)
  }

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label="Body type" options={BODY_TYPES} value={request.bodyType} onChange={handleTypeChange} />
      </Toolbar>
      {request.bodyType === BODY_SOAP && <SoapBar request={request} onUpdateRequest={onUpdateRequest} />}
      {replacedByGraphQL && (
        <Notice>The method is GRAPHQL, so the body is built from the GraphQL tab and this one is not sent.</Notice>
      )}
      <BodyEditor
        request={request}
        editorPath={editorPath}
        onChange={(body) => onUpdateRequest({ body })}
        EditorComponent={EditorComponent}
      />
    </Panel>
  )
}
