import { Suspense, useMemo } from "react"
import { FileX } from "lucide-react"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { InfoTip } from "./ui/infoTip"
import { Notice, Panel, PanelBody, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { EditorSkeleton } from "./ui/skeleton"
import { BinaryEncoder } from "./BinaryEncoder"
import { FileField } from "./FileField"
import { FormatButton, FormatProblem } from "./FormatControls"
import { SoapBar } from "./SoapBar"
import { KeyValueEditor } from "./KeyValueEditor"
import {
  BODY_BINARY,
  BODY_FORM,
  BODY_JSON,
  BODY_MULTIPART,
  BODY_NONE,
  BODY_SOAP,
  RAW_SOCKET_METHODS,
  bodyTypesFor,
  withBodyTypeFor,
  BODY_XML,
  isFormattedType,
  switchBodyType,
} from "../lib/body"
import { useEditorFormatting } from "../hooks/useEditorFormatting"
import { EMPTY_ATTACHMENT } from "../lib/attachments"
import { BODY_TEXT } from "../lib/bodyText"
import { isPlainObject, lookup, parseJSON } from "../lib/dataUtils"
import { addJsonRpcCall } from "../lib/jsonRpc"
import { parseRows, serializeRows } from "../lib/rows"
import { SOAP_11, soapTemplate } from "../lib/soap"

const PLAIN_TEXT_LANGUAGE = "plaintext"
const EDITOR_LANGUAGES = { [BODY_JSON]: "json", [BODY_XML]: "xml", [BODY_SOAP]: "xml" }

const BODILESS_METHODS = ["GET", "HEAD"]

function RowsBody({ body, typed, onChange }) {
  const rows = useMemo(() => parseRows(body), [body])
  return <KeyValueEditor rows={rows} typed={typed} onChange={(next) => onChange(serializeRows(next))} />
}

function BinaryBody({ body, onChange }) {
  const stored = useMemo(() => parseJSON(body, EMPTY_ATTACHMENT), [body])
  const file = isPlainObject(stored) ? { ...EMPTY_ATTACHMENT, ...stored } : EMPTY_ATTACHMENT
  const attach = (attachment) => onChange(JSON.stringify(attachment))
  return (
    <PanelBody>
      <FileField fileName={file.fileName} data={file.data} path={file.path} onChange={attach} />
      <BinaryEncoder onAttach={attach} />
    </PanelBody>
  )
}

function RawBody({ body, bodyType, editorPath, editorRef, onChange, onFormat, EditorComponent }) {
  return (
    <div dir="ltr" className="min-h-0 flex-1">
      <Suspense fallback={<EditorSkeleton />}>
        <EditorComponent
          ref={editorRef}
          onFormat={isFormattedType(bodyType) ? onFormat : undefined}
          value={body}
          onChange={(event) => onChange(event.target.value)}
          language={lookup(EDITOR_LANGUAGES, bodyType) || PLAIN_TEXT_LANGUAGE}
          path={editorPath}
          variables
          height="100%"
          surface="body"
          label={BODY_TEXT.editorLabel}
        />
      </Suspense>
    </div>
  )
}

function BodyEditor({ request, editorPath, editorRef, onChange, onFormat, EditorComponent }) {
  const { body, bodyType } = request
  if (bodyType === BODY_NONE) {
    return (
      <PanelBody>
        <EmptyState icon={FileX} title={BODY_TEXT.noBody} description={BODY_TEXT.noBodyDescription} />
      </PanelBody>
    )
  }
  if (bodyType === BODY_FORM) return <RowsBody body={body} onChange={onChange} />
  if (bodyType === BODY_MULTIPART) return <RowsBody body={body} typed onChange={onChange} />
  if (bodyType === BODY_BINARY) return <BinaryBody body={body} onChange={onChange} />
  return (
    <RawBody
      body={body}
      bodyType={bodyType}
      editorPath={editorPath}
      editorRef={editorRef}
      onChange={onChange}
      onFormat={onFormat}
      EditorComponent={EditorComponent}
    />
  )
}

function JsonRpcButton({ body, onChange }) {
  const extended = addJsonRpcCall(body)
  return (
    <Button variant="outline" size="sm" title={BODY_TEXT.jsonRpcTitle} disabled={extended === null} onClick={() => onChange(extended)}>
      {BODY_TEXT.jsonRpc}
    </Button>
  )
}

export function BodyPanel({ request: stored, drafts, editorPath, replacedByGraphQL, onUpdateRequest, onDraftsChange, EditorComponent }) {
  const request = withBodyTypeFor(stored)
  const formatting = useEditorFormatting(request.body, request.bodyType)
  const handleTypeChange = (bodyType) => {
    const next = switchBodyType(request, drafts, bodyType)
    const body = next.updates.body ?? request.body
    onDraftsChange(next.drafts)
    onUpdateRequest(bodyType === BODY_SOAP && body.trim() === "" ? { ...next.updates, body: soapTemplate(SOAP_11) } : next.updates)
  }

  return (
    <Panel>
      <Toolbar>
        <SegmentedControl label={BODY_TEXT.typeLabel} options={bodyTypesFor(request.method)} value={request.bodyType} onChange={handleTypeChange} />
        {RAW_SOCKET_METHODS.includes(request.method) && <InfoTip text={request.method === 'NATS' ? BODY_TEXT.natsSocket : BODY_TEXT.rawSocket} />}
        {request.bodyType === BODY_JSON && <JsonRpcButton body={request.body} onChange={(body) => onUpdateRequest({ body })} />}
        {isFormattedType(request.bodyType) && (
          <FormatButton
            language={request.bodyType}
            disabled={request.body.trim() === ""}
            onClick={formatting.format}
            className="ms-auto"
          />
        )}
      </Toolbar>
      {request.bodyType === BODY_SOAP && <SoapBar request={request} onUpdateRequest={onUpdateRequest} />}
      {replacedByGraphQL && (
        <Notice>{BODY_TEXT.replacedByGraphQL}</Notice>
      )}
      {request.bodyType === BODY_MULTIPART && BODILESS_METHODS.includes(request.method) && <Notice>{BODY_TEXT.multipartOnGet}</Notice>}
      {formatting.shownProblem && <FormatProblem language={request.bodyType} error={formatting.shownProblem} onReveal={formatting.reveal} />}
      <BodyEditor
        request={request}
        editorPath={editorPath}
        editorRef={formatting.editorRef}
        onChange={(body) => onUpdateRequest({ body })}
        onFormat={formatting.onFormat}
        EditorComponent={EditorComponent}
      />
    </Panel>
  )
}
