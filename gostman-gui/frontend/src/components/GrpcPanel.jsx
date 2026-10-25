import { Suspense, useMemo, useRef, useState } from "react"
import { FilePlus } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Notice, Panel, STACKED_TOOLBAR, SectionLabel, Toolbar, ToolbarSummary } from "./ui/panel"
import { Select } from "./ui/select"
import { EditorSkeleton } from "./ui/skeleton"
import { maxAttachmentBytes } from "../lib/attachments"
import { formatSize } from "../lib/dataUtils"
import {
  GRPC_METHOD, findMethod, isBlankMessage, mergeProtoFiles, methodKind, parseProtoFiles, readProtoFile,
} from "../lib/grpc"
import { GRPC_TEXT as TEXT } from "../lib/grpcText"

const tooLargeMessage = (file) => TEXT.tooLarge(file.name, formatSize(file.size), formatSize(maxAttachmentBytes()))

function ProtoFilePicker({ files, onChange, onError }) {
  const inputRef = useRef(null)

  const handlePick = async (event) => {
    const picked = Array.from(event.target.files)
    event.target.value = ""
    if (picked.length === 0) return
    const oversized = picked.find((file) => file.size > maxAttachmentBytes())
    if (oversized) {
      onError(tooLargeMessage(oversized))
      return
    }
    onError("")
    onChange(mergeProtoFiles(files, await Promise.all(picked.map(readProtoFile))))
  }

  return (
    <>
      <input ref={inputRef} type="file" accept=".proto" multiple className="hidden" onChange={handlePick} />
      <Button variant="outline" size="sm" onClick={() => inputRef.current.click()}>
        <FilePlus />
        {TEXT.addProtos}
      </Button>
    </>
  )
}

function methodOptions({ services, method, isListed }) {
  return (
    <>
      <option value="">{TEXT.chooseMethod}</option>
      {method && !isListed && <option value={method}>{method}</option>}
      {services.map((service) => (
        <optgroup key={service.name} label={service.name}>
          {service.methods.map((candidate) => (
            <option key={candidate.fullName} value={candidate.fullName}>{candidate.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

function MethodField({ services, method, isListed, onChange }) {
  if (!services) {
    return (
      <Input
        value={method}
        onChange={(event) => onChange(event.target.value)}
        placeholder={TEXT.methodPlaceholder}
        aria-label={TEXT.methodLabel}
        spellCheck={false}
        className="font-mono"
      />
    )
  }
  return (
    <Select value={method} onChange={(event) => onChange(event.target.value)} aria-label={TEXT.methodLabel} className="font-mono">
      {methodOptions({ services, method, isListed })}
    </Select>
  )
}

function SchemaNotice({ schema, fileError }) {
  if (fileError) return <Notice tone="destructive" role="alert">{fileError}</Notice>
  if (schema?.error) return <Notice tone="destructive" role="alert">{schema.error}</Notice>
  if (schema?.services?.length === 0) return <Notice tone="warning">{TEXT.noServices}</Notice>
  if (!schema) return <Notice>{TEXT.schemaHint}</Notice>
  return null
}

export function GrpcPanel({ request, schema, editorPath, onUpdateRequest, onProtosChange, onLoadSchema, EditorComponent }) {
  const { method, grpcMethod, grpcMessage, grpcProtos } = request
  const [fileError, setFileError] = useState("")

  const files = useMemo(() => parseProtoFiles(grpcProtos), [grpcProtos])
  const services = schema?.services
  const selected = useMemo(() => (services ? findMethod(services, grpcMethod) : undefined), [services, grpcMethod])
  const source = files.length > 0 ? files.map((file) => file.name).join(", ") : TEXT.reflection
  const isGrpc = method === GRPC_METHOD

  const chooseMethod = (fullName) => {
    const chosen = services ? findMethod(services, fullName) : undefined
    const prefill = chosen && isBlankMessage(grpcMessage) ? { grpcMessage: chosen.skeleton } : {}
    onUpdateRequest({ grpcMethod: fullName, ...prefill })
  }

  const removeFiles = () => {
    setFileError("")
    onProtosChange([])
  }

  return (
    <Panel>
      <Toolbar className={STACKED_TOOLBAR}>
        <ToolbarSummary label={TEXT.services} title={source}>{source}</ToolbarSummary>
        {!isGrpc && (
          <Button variant="outline" size="sm" onClick={() => onUpdateRequest({ method: GRPC_METHOD })}>{TEXT.sendAsGrpc}</Button>
        )}
        <ProtoFilePicker files={files} onChange={onProtosChange} onError={setFileError} />
        {files.length > 0 && <Button variant="outline" size="sm" onClick={removeFiles}>{TEXT.removeFiles}</Button>}
        <Button variant="outline" size="sm" disabled={Boolean(schema?.loading)} onClick={onLoadSchema}>
          {services ? TEXT.reload : TEXT.load}
        </Button>
      </Toolbar>
      <SchemaNotice schema={schema} fileError={fileError} />
      <Toolbar>
        <SectionLabel>{TEXT.method}</SectionLabel>
        <div className="min-w-0 flex-1">
          <MethodField services={services} method={grpcMethod} isListed={Boolean(selected)} onChange={chooseMethod} />
        </div>
        {selected && <span className="shrink-0 text-xs text-muted-foreground">{methodKind(selected)}</span>}
        <Button
          variant="outline"
          size="sm"
          disabled={!selected}
          title={TEXT.useExampleTitle}
          onClick={() => onUpdateRequest({ grpcMessage: selected.skeleton })}
        >
          {TEXT.useExample}
        </Button>
      </Toolbar>
      {selected?.clientStreaming && <Notice>{TEXT.streamHint}</Notice>}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<EditorSkeleton />}>
          <EditorComponent
            value={grpcMessage}
            onChange={(event) => onUpdateRequest({ grpcMessage: event.target.value })}
            label={TEXT.messageLabel}
            language="json"
            path={editorPath}
            variables
            fileReads={false}
            height="100%"
            surface="body"
          />
        </Suspense>
      </div>
    </Panel>
  )
}
