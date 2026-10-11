import { memo, lazy, Suspense, useEffect, useMemo } from "react"
import { AlertCircle, Bookmark, CheckCircle2 } from "lucide-react"
import { Button } from "./ui/button"
import { Notice, Panel, Toolbar } from "./ui/panel"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { AuthPanel } from "./AuthPanel"
import { BodyPanel } from "./BodyPanel"
import { KeyValueEditor } from "./KeyValueEditor"
import { ParamsPanel } from "./ParamsPanel"
import { SettingsPanel } from "./SettingsPanel"
import { ExtractPanel } from "./ExtractPanel"
import { TestsPanel } from "./TestsPanel"
import { BODY_FORM, BODY_MULTIPART, BODY_NONE } from "../lib/body"
import { parseExtractors } from "../lib/chaining"
import { parseExamples } from "../lib/examples"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { GRPC_METHOD, GRPC_PANEL } from "../lib/grpc"
import { MCP_METHOD, MCP_PANEL } from "../lib/mcp"
import { readParamRows } from "../lib/queryString"
import { countActiveAssertions } from "../lib/scripting/assertions"
import { countSentRows, parseRows, serializeRows } from "../lib/rows"
import { SOCKET_OPEN, SOCKET_PANEL, isSocketAddress, selectSession, useSocketStore } from "../lib/socketSessions"
import { validateEnvVariables, formatJSONError } from "../lib/validation"
import { DEFAULT_REQUEST_PANEL, useAppStore } from "../store/appStore"

const GraphQLPanel = lazy(() => import("./GraphQLPanel").then((module) => ({ default: module.GraphQLPanel })))
const GrpcPanel = lazy(() => import("./GrpcPanel").then((module) => ({ default: module.GrpcPanel })))
const McpPanel = lazy(() => import("./McpPanel").then((module) => ({ default: module.McpPanel })))
const WebSocketPanel = lazy(() => import("./WebSocketPanel").then((module) => ({ default: module.WebSocketPanel })))

const ROW_BODY_TYPES = [BODY_FORM, BODY_MULTIPART]
const PANEL_CLASS = "h-full min-h-0"

function PanelFallback() {
  return <p className="p-3 text-xs text-muted-foreground">Loading</p>
}

function TabBadge({ value }) {
  if (!value) return null
  if (value === true) return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
  return <TabCount>{value}</TabCount>
}

function bodyBadge(body, bodyType) {
  if (bodyType === BODY_NONE) return false
  if (ROW_BODY_TYPES.includes(bodyType)) return countSentRows(parseRows(body))
  return body.trim() !== ""
}

function EnvVarsStatus({ variables }) {
  const validation = useMemo(() => validateEnvVariables(variables), [variables])
  return (
    <Notice
      edge="border-t"
      tone={validation.error ? "destructive" : "success"}
      icon={validation.error ? AlertCircle : CheckCircle2}
    >
      {formatJSONError(validation)}
    </Notice>
  )
}

export const RequestTabs = memo(function RequestTabs({
  tabId,
  activeRequest,
  bodyDrafts,
  onUpdateRequest,
  onBodyDraftsChange,
  variables,
  onUpdateVariables,
  response,
  extraction,
  tokenRequest,
  schema,
  grpcSchema,
  mcpCatalog,
  actions,
  EditorComponent,
}) {
  const activePanel = useAppStore((state) => state.requestPanel)
  const setActivePanel = useAppStore((state) => state.setRequestPanel)
  const isSocketOpen = useSocketStore((state) => selectSession(tabId)(state).status === SOCKET_OPEN)
  const { url, queryParams, headers, body, bodyType, auth, options, method, extractors, assertions, examples, preScript, postScript } = activeRequest
  const isWebSocket = useMemo(() => isSocketAddress(url, variables), [url, variables])
  const isGraphQL = method === GRAPHQL_METHOD
  const isGrpc = method === GRPC_METHOD
  const isMcp = method === MCP_METHOD
  const shownPanel = activePanel === MCP_PANEL && !isMcp ? DEFAULT_REQUEST_PANEL : activePanel

  useEffect(() => {
    if (isWebSocket) setActivePanel(SOCKET_PANEL)
  }, [isWebSocket, setActivePanel])

  useEffect(() => {
    if (isGrpc) setActivePanel(GRPC_PANEL)
  }, [isGrpc, setActivePanel])

  useEffect(() => {
    if (isMcp) setActivePanel(MCP_PANEL)
  }, [isMcp, setActivePanel])

  const headerRows = useMemo(() => parseRows(headers), [headers])
  const paramCount = useMemo(() => countSentRows(readParamRows(url, queryParams)), [url, queryParams])
  const bodyContent = useMemo(() => bodyBadge(body, bodyType), [body, bodyType])
  const extractorCount = useMemo(() => parseExtractors(extractors).filter((extractor) => extractor.enabled).length, [extractors])
  const assertionCount = useMemo(() => countActiveAssertions(assertions), [assertions])
  const exampleCount = useMemo(() => parseExamples(examples).length, [examples])
  const hasScripts = preScript.trim() !== "" || postScript.trim() !== ""
  const hasCustomOptions = options.timeoutMs > 0 || options.noFollowRedirects || options.insecureTLS

  const handleGraphQLQueryChange = (graphqlQuery) => {
    onUpdateRequest(graphqlQuery.trim() === "" ? { graphqlQuery } : { graphqlQuery, method: GRAPHQL_METHOD })
  }

  return (
    <Tabs value={shownPanel} onValueChange={setActivePanel} className="flex min-h-0 flex-1 flex-col">
      <Toolbar>
        <TabsList label="Request sections">
          <TabsTrigger value="params">Params<TabBadge value={paramCount} /></TabsTrigger>
          <TabsTrigger value="headers">Headers<TabBadge value={countSentRows(headerRows)} /></TabsTrigger>
          <TabsTrigger value="body">Body<TabBadge value={!isGraphQL && bodyContent} /></TabsTrigger>
          <TabsTrigger value="auth">Auth<TabBadge value={auth.type !== ""} /></TabsTrigger>
          <TabsTrigger value="graphql">GraphQL<TabBadge value={isGraphQL} /></TabsTrigger>
          <TabsTrigger value={GRPC_PANEL}>gRPC<TabBadge value={isGrpc} /></TabsTrigger>
          {isMcp && <TabsTrigger value={MCP_PANEL}>MCP</TabsTrigger>}
          <TabsTrigger value={SOCKET_PANEL}>WebSocket<TabBadge value={isSocketOpen} /></TabsTrigger>
          <TabsTrigger value="vars">Env vars</TabsTrigger>
          <TabsTrigger value="extract">Extract<TabBadge value={extractorCount} /></TabsTrigger>
          <TabsTrigger value="tests">Tests<TabBadge value={assertionCount || hasScripts} /></TabsTrigger>
          <TabsTrigger value="settings">Settings<TabBadge value={hasCustomOptions} /></TabsTrigger>
        </TabsList>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Examples"
          title="Saved response examples"
          onClick={actions.examples.open}
          className="ml-auto px-1.5"
        >
          <Bookmark />
          <TabBadge value={exampleCount} />
        </Button>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value="params" className={PANEL_CLASS}>
          <ParamsPanel key={tabId} url={url} queryParams={queryParams} onChange={onUpdateRequest} />
        </TabsContent>

        <TabsContent value="headers" className={PANEL_CLASS}>
          <Panel>
            <KeyValueEditor
              key={tabId}
              rows={headerRows}
              onChange={(rows) => onUpdateRequest({ headers: serializeRows(rows) })}
              keyLabel="Header"
            />
          </Panel>
        </TabsContent>

        <TabsContent value="body" className={PANEL_CLASS}>
          <BodyPanel
            key={tabId}
            request={activeRequest}
            drafts={bodyDrafts}
            editorPath={`${tabId}/body`}
            replacedByGraphQL={isGraphQL}
            onUpdateRequest={onUpdateRequest}
            onDraftsChange={onBodyDraftsChange}
            EditorComponent={EditorComponent}
          />
        </TabsContent>

        <TabsContent value="auth" className={PANEL_CLASS}>
          <AuthPanel
            key={tabId}
            auth={auth}
            tokenRequest={tokenRequest}
            actions={actions}
            onChange={(next) => onUpdateRequest({ auth: next })}
          />
        </TabsContent>

        <TabsContent value="graphql" className={PANEL_CLASS}>
          <Suspense fallback={<PanelFallback />}>
            <GraphQLPanel
              key={tabId}
              query={activeRequest.graphqlQuery}
              variables={activeRequest.graphqlVariables}
              environment={variables}
              schema={schema}
              method={method}
              onQueryChange={handleGraphQLQueryChange}
              onVariablesChange={(graphqlVariables) => onUpdateRequest({ graphqlVariables })}
              onUseGraphQL={() => onUpdateRequest({ method: GRAPHQL_METHOD })}
              onLoadSchema={actions.loadSchema}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value={GRPC_PANEL} className={PANEL_CLASS}>
          <Suspense fallback={<PanelFallback />}>
            <GrpcPanel
              key={tabId}
              request={activeRequest}
              schema={grpcSchema}
              editorPath={`${tabId}/grpc`}
              onUpdateRequest={onUpdateRequest}
              onProtosChange={actions.setGrpcProtos}
              onLoadSchema={actions.loadGrpcSchema}
              EditorComponent={EditorComponent}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value={MCP_PANEL} className={PANEL_CLASS}>
          <Suspense fallback={<PanelFallback />}>
            <McpPanel
              key={tabId}
              request={activeRequest}
              catalog={mcpCatalog}
              editorPath={`${tabId}/mcp`}
              onUpdateRequest={onUpdateRequest}
              onLoadCatalog={actions.loadMcpCatalog}
              EditorComponent={EditorComponent}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value={SOCKET_PANEL} className={PANEL_CLASS}>
          <Suspense fallback={<PanelFallback />}>
            <WebSocketPanel
              key={tabId}
              tabId={tabId}
              request={activeRequest}
              variables={variables}
              sockets={actions.sockets}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="vars" className={PANEL_CLASS}>
          <Panel>
            <div className="min-h-0 flex-1">
              <Suspense fallback={<PanelFallback />}>
                <EditorComponent
                  value={variables}
                  onChange={(event) => onUpdateVariables(event.target.value)}
                  language="json"
                  path="environment/variables"
                  height="100%"
                />
              </Suspense>
            </div>
            <EnvVarsStatus variables={variables} />
          </Panel>
        </TabsContent>

        <TabsContent value="extract" className={PANEL_CLASS}>
          <ExtractPanel
            key={tabId}
            extractors={extractors}
            response={response}
            extraction={extraction}
            onChange={(next) => onUpdateRequest({ extractors: next })}
            onRun={() => actions.runExtractors(tabId)}
          />
        </TabsContent>

        <TabsContent value="tests" className={PANEL_CLASS}>
          <TestsPanel
            key={tabId}
            request={activeRequest}
            editorPath={tabId}
            onUpdateRequest={onUpdateRequest}
            EditorComponent={EditorComponent}
          />
        </TabsContent>

        <TabsContent value="settings" className={PANEL_CLASS}>
          <SettingsPanel options={options} onChange={(next) => onUpdateRequest({ options: next })} />
        </TabsContent>
      </div>
    </Tabs>
  )
})
