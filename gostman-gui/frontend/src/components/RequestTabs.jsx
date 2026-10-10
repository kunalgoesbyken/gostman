import { memo, lazy, Suspense, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Braces, Hash, Heading1, FolderOpen, FlaskConical, KeyRound, SlidersHorizontal, Zap, Radio, AlertCircle, CheckCircle2 } from "lucide-react"
import { AuthPanel } from "./AuthPanel"
import { BodyPanel } from "./BodyPanel"
import { KeyValueEditor } from "./KeyValueEditor"
import { ParamsPanel } from "./ParamsPanel"
import { SettingsPanel } from "./SettingsPanel"
import { ExtractPanel } from "./ExtractPanel"
import { BODY_FORM, BODY_MULTIPART, BODY_NONE } from "../lib/body"
import { parseExtractors } from "../lib/chaining"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { readParamRows } from "../lib/queryString"
import { countSentRows, parseRows, serializeRows } from "../lib/rows"
import { SOCKET_OPEN, SOCKET_PANEL, isSocketAddress, selectSession, useSocketStore } from "../lib/socketSessions"
import { validateEnvVariables, formatJSONError } from "../lib/validation"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const GraphQLPanel = lazy(() => import("./GraphQLPanel").then((module) => ({ default: module.GraphQLPanel })))
const WebSocketPanel = lazy(() => import("./WebSocketPanel").then((module) => ({ default: module.WebSocketPanel })))

const ROW_BODY_TYPES = [BODY_FORM, BODY_MULTIPART]

function PanelFallback() {
  return <p className="p-4 text-sm text-muted-foreground">Loading...</p>
}

function TabBadge({ value }) {
  if (!value) return null
  if (value === true) return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
  return (
    <span className="rounded bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">{value}</span>
  )
}

function bodyBadge(body, bodyType) {
  if (bodyType === BODY_NONE) return false
  if (ROW_BODY_TYPES.includes(bodyType)) return countSentRows(parseRows(body))
  return body.trim() !== ""
}

function EnvVarsStatus({ variables }) {
  const validation = useMemo(() => validateEnvVariables(variables), [variables])
  const Icon = validation.error ? AlertCircle : CheckCircle2

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t px-4 py-2 text-xs",
        validation.error ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-success/20 bg-success/10 text-success"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{formatJSONError(validation)}</span>
    </div>
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
  schema,
  actions,
  EditorComponent,
}) {
  const activePanel = useAppStore((state) => state.requestPanel)
  const setActivePanel = useAppStore((state) => state.setRequestPanel)
  const isSocketOpen = useSocketStore((state) => selectSession(tabId)(state).status === SOCKET_OPEN)
  const { url, queryParams, headers, body, bodyType, auth, options, method, extractors } = activeRequest
  const isWebSocket = useMemo(() => isSocketAddress(url, variables), [url, variables])
  const isGraphQL = method === GRAPHQL_METHOD

  useEffect(() => {
    if (isWebSocket) setActivePanel(SOCKET_PANEL)
  }, [isWebSocket, setActivePanel])

  const headerRows = useMemo(() => parseRows(headers), [headers])
  const paramCount = useMemo(() => countSentRows(readParamRows(url, queryParams)), [url, queryParams])
  const bodyContent = useMemo(() => bodyBadge(body, bodyType), [body, bodyType])
  const extractorCount = useMemo(() => parseExtractors(extractors).filter((extractor) => extractor.enabled).length, [extractors])
  const hasCustomOptions = options.timeoutMs > 0 || options.noFollowRedirects || options.insecureTLS

  const handleGraphQLQueryChange = (graphqlQuery) => {
    onUpdateRequest(graphqlQuery.trim() === "" ? { graphqlQuery } : { graphqlQuery, method: GRAPHQL_METHOD })
  }

  return (
    <Tabs value={activePanel} onValueChange={setActivePanel} className="flex min-h-0 flex-1 flex-col">
      <div className="overflow-x-auto border-b border-border/60 bg-muted/10 px-4">
        <TabsList>
          <TabsTrigger value="params" icon={Hash}>Params<TabBadge value={paramCount} /></TabsTrigger>
          <TabsTrigger value="headers" icon={Heading1}>Headers<TabBadge value={countSentRows(headerRows)} /></TabsTrigger>
          <TabsTrigger value="body" icon={Braces}>Body<TabBadge value={!isGraphQL && bodyContent} /></TabsTrigger>
          <TabsTrigger value="auth" icon={KeyRound}>Auth<TabBadge value={auth.type !== ""} /></TabsTrigger>
          <TabsTrigger value="graphql" icon={Zap}>GraphQL<TabBadge value={isGraphQL} /></TabsTrigger>
          <TabsTrigger value={SOCKET_PANEL} icon={Radio}>WebSocket<TabBadge value={isSocketOpen} /></TabsTrigger>
          <TabsTrigger value="vars" icon={FolderOpen}>Env Vars</TabsTrigger>
          <TabsTrigger value="extract" icon={FlaskConical}>Extract<TabBadge value={extractorCount} /></TabsTrigger>
          <TabsTrigger value="settings" icon={SlidersHorizontal}>Settings<TabBadge value={hasCustomOptions} /></TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="params" className="h-full p-0" noMargin>
          <ParamsPanel key={tabId} url={url} queryParams={queryParams} onChange={onUpdateRequest} />
        </TabsContent>

        <TabsContent value="headers" className="h-full p-0" noMargin>
          <KeyValueEditor
            key={tabId}
            rows={headerRows}
            onChange={(rows) => onUpdateRequest({ headers: serializeRows(rows) })}
            keyLabel="Header"
          />
        </TabsContent>

        <TabsContent value="body" className="h-full p-0" noMargin>
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

        <TabsContent value="auth" className="h-full p-0" noMargin>
          <AuthPanel key={tabId} auth={auth} onChange={(next) => onUpdateRequest({ auth: next })} />
        </TabsContent>

        <TabsContent value="graphql" className="h-full p-0" noMargin>
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

        <TabsContent value={SOCKET_PANEL} className="h-full p-0" noMargin>
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

        <TabsContent value="vars" className="h-full p-0" noMargin>
          <div className="flex h-full flex-col">
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
          </div>
        </TabsContent>

        <TabsContent value="extract" className="h-full p-0" noMargin>
          <ExtractPanel
            key={tabId}
            extractors={extractors}
            response={response}
            extraction={extraction}
            onChange={(next) => onUpdateRequest({ extractors: next })}
            onRun={() => actions.runExtractors(tabId)}
          />
        </TabsContent>

        <TabsContent value="settings" className="h-full p-0" noMargin>
          <SettingsPanel options={options} onChange={(next) => onUpdateRequest({ options: next })} />
        </TabsContent>
      </div>
    </Tabs>
  )
})
