import { Suspense, useMemo, useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Notice, Panel, SectionLabel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { EditorSkeleton } from "./ui/skeleton"
import { isBlankMessage } from "../lib/grpc"
import { findTool, isLocalCommand } from "../lib/mcp"

const TOOL_PLACEHOLDER = "tool_name"
const NOT_LOADED = "Tools not loaded"
const CATALOG_HINTS = {
  remote: "Load the tools from the MCP server at this URL. The headers and auth of this request are sent with every call. In the desktop app, write stdio: and a command in the address bar to start a local server instead, for example stdio:npx -y @modelcontextprotocol/server-everything.",
  local: "Load starts this command on this computer and reads its tools; every call starts it again. The rows on the Headers tab are passed to it as environment variables.",
}

const serverLabel = ({ server, protocolVersion }) => (
  [server.name, server.version, protocolVersion && `MCP ${protocolVersion}`].filter(Boolean).join(" ")
)

function toolOptions({ tools, tool, isListed }) {
  return (
    <>
      <option value="">Choose a tool</option>
      {tool && !isListed && <option value={tool}>{tool}</option>}
      {tools.map((candidate) => (
        <option key={candidate.name} value={candidate.name}>{candidate.name}</option>
      ))}
    </>
  )
}

function ToolField({ tools, tool, isListed, onChange }) {
  if (!tools) {
    return (
      <Input
        value={tool}
        onChange={(event) => onChange(event.target.value)}
        placeholder={TOOL_PLACEHOLDER}
        aria-label="MCP tool"
        spellCheck={false}
        className="font-mono"
      />
    )
  }
  return (
    <Select value={tool} onChange={(event) => onChange(event.target.value)} aria-label="MCP tool" className="font-mono">
      {toolOptions({ tools, tool, isListed })}
    </Select>
  )
}

function CatalogNotice({ catalog, isLocal }) {
  if (catalog?.error) return <Notice tone="destructive" role="alert">{catalog.error}</Notice>
  if (catalog?.tools?.length === 0) return <Notice tone="warning">This server lists no tools.</Notice>
  if (!catalog?.tools) return <Notice>{isLocal ? CATALOG_HINTS.local : CATALOG_HINTS.remote}</Notice>
  return null
}

function ToolDetails({ tool, showsSchema }) {
  return (
    <>
      {tool.description && <Notice>{tool.description}</Notice>}
      {showsSchema && (
        <pre className="max-h-40 shrink-0 overflow-auto border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
          {tool.inputSchema}
        </pre>
      )}
    </>
  )
}

export function McpPanel({ request, catalog, editorPath, onUpdateRequest, onLoadCatalog, EditorComponent }) {
  const { mcpTool, mcpArguments } = request
  const [showsSchema, setShowsSchema] = useState(false)

  const tools = catalog?.tools
  const selected = useMemo(() => (tools ? findTool(tools, mcpTool) : undefined), [tools, mcpTool])
  const server = tools ? serverLabel(catalog) : NOT_LOADED

  const chooseTool = (name) => {
    const chosen = tools ? findTool(tools, name) : undefined
    const prefill = chosen && isBlankMessage(mcpArguments) ? { mcpArguments: chosen.skeleton } : {}
    onUpdateRequest({ mcpTool: name, ...prefill })
  }

  return (
    <Panel>
      <Toolbar>
        <SectionLabel>Server</SectionLabel>
        <span title={catalog?.instructions || server} className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{server}</span>
        <Button variant="outline" size="sm" disabled={Boolean(catalog?.loading)} onClick={onLoadCatalog}>
          {tools ? "Reload" : "Load"}
        </Button>
      </Toolbar>
      <CatalogNotice catalog={catalog} isLocal={isLocalCommand(request)} />
      <Toolbar>
        <SectionLabel>Tool</SectionLabel>
        <div className="min-w-0 flex-1">
          <ToolField tools={tools} tool={mcpTool} isListed={Boolean(selected)} onChange={chooseTool} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!selected}
          aria-pressed={showsSchema}
          title="Show the JSON Schema of the tool's arguments"
          onClick={() => setShowsSchema(!showsSchema)}
        >
          Schema
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!selected}
          title="Replace the arguments with an example built from the tool's schema"
          onClick={() => onUpdateRequest({ mcpArguments: selected.skeleton })}
        >
          Use example
        </Button>
      </Toolbar>
      {selected && <ToolDetails tool={selected} showsSchema={showsSchema} />}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<EditorSkeleton />}>
          <EditorComponent
            value={mcpArguments}
            onChange={(event) => onUpdateRequest({ mcpArguments: event.target.value })}
            language="json"
            path={editorPath}
            height="100%"
          />
        </Suspense>
      </div>
    </Panel>
  )
}
