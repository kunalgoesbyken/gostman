import { Suspense, useMemo, useRef, useState } from "react"
import { Braces, FileX } from "lucide-react"
import { Button } from "./ui/button"
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
import { chordLabel } from "../lib/chords"
import { isPlainObject, lookup, parseJSON } from "../lib/dataUtils"
import { isApplePlatform } from "../lib/platform"
import { parseRows, serializeRows } from "../lib/rows"
import { SOAP_11, soapTemplate } from "../lib/soap"

const PLAIN_TEXT_LANGUAGE = "plaintext"
const EDITOR_LANGUAGES = { [BODY_JSON]: "json", [BODY_XML]: "xml", [BODY_SOAP]: "xml" }
const FORMATTED_TYPE_NAMES = { [BODY_JSON]: "JSON", [BODY_XML]: "XML" }
const FORMAT_CHORD = { shift: true, alt: true, key: "f" }

const BODY_TEXT = {
  format: "Format",
  formatTitle: (type, chord) => `Indent the ${type} body (${chord}). {{variables}} are kept as written.`,
  cannotFormatAt: (type, { line, column, message }) => `The ${type} cannot be formatted at line ${line}, column ${column}: ${message}`,
  cannotFormat: (type, { message }) => `The ${type} cannot be formatted: ${message}`,
  goToLine: (line) => `Go to line ${line}`,
}

const isFormattedType = (bodyType) => Object.hasOwn(FORMATTED_TYPE_NAMES, bodyType)

const problemText = (type, error) => (error.column === undefined ? BODY_TEXT.cannotFormat(type, error) : BODY_TEXT.cannotFormatAt(type, error))

function FormatProblem({ bodyType, error, onReveal }) {
  return (
    <Notice tone="destructive">
      {problemText(FORMATTED_TYPE_NAMES[bodyType], error)}
      {error.offset !== undefined && (
        <button type="button" onClick={() => onReveal(error.offset)} className="ml-2 underline">
          {BODY_TEXT.goToLine(error.line)}
        </button>
      )}
    </Notice>
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
    <PanelBody>
      <FileField
        fileName={file.fileName}
        data={file.data}
        onChange={(attachment) => onChange(JSON.stringify(attachment))}
      />
    </PanelBody>
  )
}

function RawBody({ body, bodyType, editorPath, editorRef, onChange, onFormat, EditorComponent }) {
  return (
    <div className="min-h-0 flex-1">
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
        <EmptyState icon={FileX} title="No body" description="This request is sent without a body." />
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

function useBodyFormatting(request) {
  const editorRef = useRef(null)
  const [problem, setProblem] = useState(null)
  const isFormatted = isFormattedType(request.bodyType)
  const shownProblem = problem && problem.body === request.body && problem.bodyType === request.bodyType ? problem.error : null

  const onFormat = (result) => setProblem(result.error ? { error: result.error, body: request.body, bodyType: request.bodyType } : null)
  const format = () => editorRef.current?.format()
  const reveal = (offset) => editorRef.current?.reveal(offset)
  return { editorRef, isFormatted, shownProblem, onFormat, format, reveal }
}

export function BodyPanel({ request, drafts, editorPath, replacedByGraphQL, onUpdateRequest, onDraftsChange, EditorComponent }) {
  const formatting = useBodyFormatting(request)
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
        {formatting.isFormatted && (
          <Button
            variant="ghost"
            size="sm"
            title={BODY_TEXT.formatTitle(FORMATTED_TYPE_NAMES[request.bodyType], chordLabel(FORMAT_CHORD, isApplePlatform()))}
            disabled={request.body.trim() === ""}
            onClick={formatting.format}
            className="ml-auto"
          >
            <Braces />
            {BODY_TEXT.format}
          </Button>
        )}
      </Toolbar>
      {request.bodyType === BODY_SOAP && <SoapBar request={request} onUpdateRequest={onUpdateRequest} />}
      {replacedByGraphQL && (
        <Notice>The method is GRAPHQL, so the body is built from the GraphQL tab and this one is not sent.</Notice>
      )}
      {formatting.shownProblem && <FormatProblem bodyType={request.bodyType} error={formatting.shownProblem} onReveal={formatting.reveal} />}
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
