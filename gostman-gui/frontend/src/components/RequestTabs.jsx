import { memo, lazy, Suspense, useEffect, useMemo, useRef } from "react"
import { Bookmark, CornerLeftUp } from "lucide-react"
import { Button } from "./ui/button"
import { Panel, Toolbar } from "./ui/panel"
import { OverflowTabsList, TabCount, Tabs, TabsContent } from "./ui/tabs"
import { SkeletonLines } from "./ui/skeleton"
import { AuthPanel } from "./AuthPanel"
import { BodyPanel } from "./BodyPanel"
import { InheritedHeaders } from "./InheritedHeaders"
import { KeyValueEditor } from "./KeyValueEditor"
import { ParamsPanel } from "./ParamsPanel"
import { SettingsPanel } from "./SettingsPanel"
import { ExtractPanel } from "./ExtractPanel"
import { TestsPanel } from "./TestsPanel"
import { useAiEnabled } from "../lib/ai/session"
import { TASK_DOCS } from "../lib/ai/tasks"
import { BODY_FORM, BODY_MULTIPART, BODY_NONE } from "../lib/body"
import { parseExtractors } from "../lib/chaining"
import { parseExamples } from "../lib/examples"
import { FOLDER_SETTINGS_TEXT as INHERIT_TEXT } from "../lib/folderSettingsText"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { GRPC_PANEL, isBlankMessage } from "../lib/grpc"
import { AUTH_INHERIT, countInheritedHeaders, inheritedAuthLayer } from "../lib/inheritance"
import { MCP_PANEL } from "../lib/mcp"
import { readParamRows } from "../lib/queryString"
import {
  AUTH_PANEL, BODY_PANEL, EXTRACT_PANEL, GRAPHQL_PANEL, HEADERS_PANEL, PARAMS_PANEL, SETTINGS_PANEL, TESTS_PANEL, VARS_PANEL,
  hasChangedSettings, hasProtocolPanel, leadSection, requestKind, requestSections, requestSettings,
} from "../lib/requestSections"
import { REQUEST_TABS_TEXT as TEXT } from "../lib/requestTabsText"
import { countActiveAssertions } from "../lib/scripting/assertions"
import { countSentRows, parseRows, serializeRows } from "../lib/rows"
import { SOCKET_IDLE, SOCKET_OPEN, SOCKET_PANEL, isSocketAddress, selectSession, useSocketStore } from "../lib/socketSessions"
import { useAppStore } from "../store/appStore"

const GraphQLPanel = lazy(() => import("./GraphQLPanel").then((module) => ({ default: module.GraphQLPanel })))
const GrpcPanel = lazy(() => import("./GrpcPanel").then((module) => ({ default: module.GrpcPanel })))
const McpPanel = lazy(() => import("./McpPanel").then((module) => ({ default: module.McpPanel })))
const WebSocketPanel = lazy(() => import("./WebSocketPanel").then((module) => ({ default: module.WebSocketPanel })))

const ROW_BODY_TYPES = [BODY_FORM, BODY_MULTIPART]
const PANEL_CLASS = "h-full min-h-0"

function PanelFallback() {
  return <SkeletonLines label={TEXT.loading} />
}

function TabBadge({ value }) {
  if (!value) return null
  if (value === true) return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
  return <TabCount>{value}</TabCount>
}

const AUTHORIZATION_AUTH = ["basic", "bearer", "oauth2"]

function InheritedMark({ title, children }) {
  return (
    <span title={title} className="inline-flex items-center gap-0.5 font-mono text-3xs text-muted-foreground">
      <CornerLeftUp aria-hidden="true" className="h-3 w-3" />
      {children && <span aria-hidden="true">{children}</span>}
      <span className="sr-only">{title}</span>
    </span>
  )
}

function bodyBadge(body, bodyType) {
  if (bodyType === BODY_NONE) return false
  if (ROW_BODY_TYPES.includes(bodyType)) return countSentRows(parseRows(body))
  return body.trim() !== ""
}

const holdsGrpcCall = (request) => request.grpcMethod.trim() !== "" || !isBlankMessage(request.grpcMessage)

const filledSections = (flags) => new Set(Object.keys(flags).filter((section) => flags[section]))

function sectionItem(value, badge, mark) {
  const label = TEXT.labels[value]
  return {
    value,
    label,
    marked: Boolean(badge),
    detail: badge ? <TabBadge value={badge} /> : null,
    content: <>{label}<TabBadge value={badge} />{mark}</>,
  }
}

function useLeadOnKindChange(kind, setActivePanel) {
  const previousKind = useRef(null)
  useEffect(() => {
    const isMount = previousKind.current === null
    if (previousKind.current === kind) return
    previousKind.current = kind
    if (!isMount || hasProtocolPanel(kind)) setActivePanel(leadSection(kind))
  }, [kind, setActivePanel])
}

export const RequestTabs = memo(function RequestTabs({
  tabId,
  activeRequest,
  bodyDrafts,
  onUpdateRequest,
  onBodyDraftsChange,
  variables,
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
  const isAiOn = useAiEnabled()
  const socketStatus = useSocketStore((state) => selectSession(tabId)(state).status)
  const { url, queryParams, headers, body, bodyType, auth, options, method, extractors, assertions, examples, preScript, postScript, vars } = activeRequest
  const authSource = useAppStore((state) => inheritedAuthLayer(state, activeRequest.folderId)?.name ?? null)
  const authSourceType = useAppStore((state) => inheritedAuthLayer(state, activeRequest.folderId)?.settings.auth.type ?? null)
  const isSocket = useMemo(() => isSocketAddress(url, variables), [url, variables])
  const kind = requestKind(activeRequest, isSocket)
  const isGraphQL = method === GRAPHQL_METHOD

  useLeadOnKindChange(kind, setActivePanel)

  const headerRows = useMemo(() => parseRows(headers), [headers])
  const inheritedHeaders = useAppStore((state) => countInheritedHeaders(state, activeRequest.folderId, headerRows))
  const variableRows = useMemo(() => parseRows(vars), [vars])
  const paramCount = useMemo(() => countSentRows(readParamRows(url, queryParams)), [url, queryParams])
  const bodyContent = useMemo(() => bodyBadge(body, bodyType), [body, bodyType])
  const extractorCount = useMemo(() => parseExtractors(extractors).filter((extractor) => extractor.enabled).length, [extractors])
  const assertionCount = useMemo(() => countActiveAssertions(assertions), [assertions])
  const exampleCount = useMemo(() => parseExamples(examples).length, [examples])
  const hasScripts = preScript.trim() !== "" || postScript.trim() !== ""
  const hasCustomOptions = hasChangedSettings(options)
  const hasOwnAuth = auth.type !== "" && auth.type !== AUTH_INHERIT

  const sections = requestSections(kind, filledSections({
    [PARAMS_PANEL]: paramCount > 0,
    [BODY_PANEL]: Boolean(bodyContent),
    [AUTH_PANEL]: hasOwnAuth,
    [GRAPHQL_PANEL]: activeRequest.graphqlQuery.trim() !== "",
    [GRPC_PANEL]: holdsGrpcCall(activeRequest),
    [SOCKET_PANEL]: socketStatus !== SOCKET_IDLE,
    [EXTRACT_PANEL]: extractorCount > 0,
    [TESTS_PANEL]: assertionCount > 0 || hasScripts,
  }))
  const shownPanel = sections.includes(activePanel) ? activePanel : leadSection(kind)

  const badges = {
    [PARAMS_PANEL]: paramCount,
    [HEADERS_PANEL]: countSentRows(headerRows),
    [BODY_PANEL]: !isGraphQL && bodyContent,
    [AUTH_PANEL]: hasOwnAuth,
    [SOCKET_PANEL]: socketStatus === SOCKET_OPEN,
    [VARS_PANEL]: countSentRows(variableRows),
    [EXTRACT_PANEL]: extractorCount,
    [TESTS_PANEL]: assertionCount || hasScripts,
    [SETTINGS_PANEL]: hasCustomOptions,
  }
  const marks = {
    [HEADERS_PANEL]: inheritedHeaders > 0 && <InheritedMark title={INHERIT_TEXT.inheritedHeaders(inheritedHeaders)}>{inheritedHeaders}</InheritedMark>,
    [AUTH_PANEL]: auth.type === AUTH_INHERIT && authSource && <InheritedMark title={INHERIT_TEXT.inheritsFrom(authSource)} />,
  }
  const items = sections.map((section) => sectionItem(section, badges[section], marks[section]))

  const handleGraphQLQueryChange = (graphqlQuery) => {
    onUpdateRequest(graphqlQuery.trim() === "" ? { graphqlQuery } : { graphqlQuery, method: GRAPHQL_METHOD })
  }

  return (
    <Tabs value={shownPanel} onValueChange={setActivePanel} className="flex min-h-0 flex-1 flex-col">
      <Toolbar>
        <OverflowTabsList label={TEXT.sections} items={items} moreLabel={TEXT.more} moreHint={TEXT.moreHint} />
        <Button
          variant="ghost"
          size="sm"
          aria-label={TEXT.examples}
          title={TEXT.examplesHint}
          onClick={actions.examples.open}
          className="ml-auto shrink-0 px-1.5"
        >
          <Bookmark />
          <TabBadge value={exampleCount} />
        </Button>
      </Toolbar>

      <div className="min-h-0 flex-1 overflow-hidden">
        <TabsContent value={PARAMS_PANEL} className={PANEL_CLASS}>
          <ParamsPanel key={tabId} url={url} queryParams={queryParams} onChange={onUpdateRequest} />
        </TabsContent>

        <TabsContent value={HEADERS_PANEL} className={PANEL_CLASS}>
          <Panel>
            <KeyValueEditor
              key={tabId}
              rows={headerRows}
              onChange={(rows) => onUpdateRequest({ headers: serializeRows(rows) })}
              keyLabel={TEXT.headerLabel}
            >
              <InheritedHeaders folderId={activeRequest.folderId} ownRows={headerRows} authSource={auth.type === AUTH_INHERIT && AUTHORIZATION_AUTH.includes(authSourceType) ? authSource : null} onOpenAuth={() => setActivePanel(AUTH_PANEL)} />
            </KeyValueEditor>
          </Panel>
        </TabsContent>

        <TabsContent value={BODY_PANEL} className={PANEL_CLASS}>
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

        <TabsContent value={AUTH_PANEL} className={PANEL_CLASS}>
          <AuthPanel
            key={tabId}
            auth={auth}
            tokenRequest={tokenRequest}
            actions={actions}
            inheritance={{ source: authSource, sourceType: authSourceType, noAuthValue: "" }}
            onChange={(next) => onUpdateRequest({ auth: next })}
          />
        </TabsContent>

        <TabsContent value={GRAPHQL_PANEL} className={PANEL_CLASS}>
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
              tabId={tabId}
              request={activeRequest}
              catalog={mcpCatalog}
              editorPath={`${tabId}/mcp`}
              onUpdateRequest={onUpdateRequest}
              onLoadCatalog={actions.loadMcpCatalog}
              onAcceptTools={actions.acceptMcpTools}
              onSignIn={actions.signInToMcpServer}
              onCloseSignIn={actions.closeMcpSignIn}
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
              onUpdateRequest={onUpdateRequest}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value={VARS_PANEL} className={PANEL_CLASS}>
          <Panel>
            <KeyValueEditor
              key={tabId}
              rows={variableRows}
              onChange={(rows) => onUpdateRequest({ vars: serializeRows(rows) })}
              keyLabel={TEXT.variableLabel}
            />
          </Panel>
        </TabsContent>

        <TabsContent value={EXTRACT_PANEL} className={PANEL_CLASS}>
          <ExtractPanel
            key={tabId}
            extractors={extractors}
            response={response}
            extraction={extraction}
            onChange={(next) => onUpdateRequest({ extractors: next })}
            onRun={() => actions.runExtractors(tabId)}
          />
        </TabsContent>

        <TabsContent value={TESTS_PANEL} className={PANEL_CLASS}>
          <TestsPanel
            key={tabId}
            request={activeRequest}
            editorPath={tabId}
            onUpdateRequest={onUpdateRequest}
            EditorComponent={EditorComponent}
            ai={isAiOn ? actions.ai : null}
          />
        </TabsContent>

        <TabsContent value={SETTINGS_PANEL} className={PANEL_CLASS}>
          <SettingsPanel
            options={options}
            settings={requestSettings(kind, options)}
            description={activeRequest.description}
            tags={activeRequest.tags}
            onChange={(next) => onUpdateRequest({ options: next })}
            onDescriptionChange={(description) => onUpdateRequest({ description })}
            onTagsChange={(tags) => onUpdateRequest({ tags })}
            onDocument={isAiOn ? () => actions.ai.start(TASK_DOCS) : null}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
})
