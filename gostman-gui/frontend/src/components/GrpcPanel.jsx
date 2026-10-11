import { Suspense, useMemo, useRef, useState } from "react"
import { FilePlus } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Notice, Panel, SectionLabel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { MAX_ATTACHMENT_BYTES } from "../lib/attachments"
import { formatSize } from "../lib/dataUtils"
import {
  GRPC_METHOD, findMethod, isBlankMessage, mergeProtoFiles, methodKind, parseProtoFiles, readProtoFile,
} from "../lib/grpc"

const METHOD_PLACEHOLDER = "package.Service/Method"
const REFLECTION_SOURCE = "Server reflection"
const SCHEMA_HINT = "Load the services through server reflection, or add the service's .proto files. The address, headers and auth of this request are used."
const STREAM_HINT = "This method reads a stream. Write a JSON array to send several messages."

const tooLargeMessage = (file) => (
  `${file.name} is ${formatSize(file.size)}. Files are limited to ${formatSize(MAX_ATTACHMENT_BYTES)}.`
)

function ProtoFilePicker({ files, onChange, onError }) {
  const inputRef = useRef(null)

  const handlePick = async (event) => {
    const picked = Array.from(event.target.files)
    event.target.value = ""
    if (picked.length === 0) return
    const oversized = picked.find((file) => file.size > MAX_ATTACHMENT_BYTES)
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
        Add .proto files
      </Button>
    </>
  )
}

function MethodOptions({ services, method, isListed }) {
  return (
    <>
      <option value="">Choose a method</option>
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
        placeholder={METHOD_PLACEHOLDER}
        aria-label="gRPC method"
        spellCheck={false}
        className="font-mono"
      />
    )
  }
  return (
    <Select value={method} onChange={(event) => onChange(event.target.value)} aria-label="gRPC method" className="font-mono">
      <MethodOptions services={services} method={method} isListed={isListed} />
    </Select>
  )
}

function SchemaNotice({ schema, fileError }) {
  if (fileError) return <Notice tone="destructive" role="alert">{fileError}</Notice>
  if (schema?.error) return <Notice tone="destructive" role="alert">{schema.error}</Notice>
  if (schema?.services?.length === 0) return <Notice tone="warning">No services were found.</Notice>
  if (!schema) return <Notice>{SCHEMA_HINT}</Notice>
  return null
}

export function GrpcPanel({ request, schema, editorPath, onUpdateRequest, onProtosChange, onLoadSchema, EditorComponent }) {
  const { method, grpcMethod, grpcMessage, grpcProtos } = request
  const [fileError, setFileError] = useState("")

  const files = useMemo(() => parseProtoFiles(grpcProtos), [grpcProtos])
  const services = schema?.services
  const selected = useMemo(() => (services ? findMethod(services, grpcMethod) : undefined), [services, grpcMethod])
  const source = files.length > 0 ? files.map((file) => file.name).join(", ") : REFLECTION_SOURCE
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
      <Toolbar>
        <SectionLabel>Services</SectionLabel>
        <span title={source} className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{source}</span>
        {!isGrpc && (
          <Button variant="outline" size="sm" onClick={() => onUpdateRequest({ method: GRPC_METHOD })}>Send as gRPC</Button>
        )}
        <ProtoFilePicker files={files} onChange={onProtosChange} onError={setFileError} />
        {files.length > 0 && <Button variant="ghost" size="sm" onClick={removeFiles}>Remove files</Button>}
        <Button variant="outline" size="sm" disabled={Boolean(schema?.loading)} onClick={onLoadSchema}>
          {services ? "Reload" : "Load"}
        </Button>
      </Toolbar>
      <SchemaNotice schema={schema} fileError={fileError} />
      <Toolbar>
        <SectionLabel>Method</SectionLabel>
        <div className="min-w-0 flex-1">
          <MethodField services={services} method={grpcMethod} isListed={Boolean(selected)} onChange={chooseMethod} />
        </div>
        {selected && <span className="shrink-0 text-xs text-muted-foreground">{methodKind(selected)}</span>}
        <Button
          variant="ghost"
          size="sm"
          disabled={!selected}
          title="Replace the message with an example of the method's input"
          onClick={() => onUpdateRequest({ grpcMessage: selected.skeleton })}
        >
          Use example
        </Button>
      </Toolbar>
      {selected?.clientStreaming && <Notice>{STREAM_HINT}</Notice>}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<p className="p-3 text-xs text-muted-foreground">Loading editor</p>}>
          <EditorComponent
            value={grpcMessage}
            onChange={(event) => onUpdateRequest({ grpcMessage: event.target.value })}
            language="json"
            path={editorPath}
            height="100%"
          />
        </Suspense>
      </div>
    </Panel>
  )
}
