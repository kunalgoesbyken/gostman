import React, { memo, lazy, Suspense, useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Braces, Hash, Heading1, FolderOpen, FlaskConical, Zap, Radio, AlertCircle, CheckCircle2 } from "lucide-react"
import { TestScriptsPanel } from "./TestScriptsPanel"
import { ParamsPanel } from "./ParamsPanel"
import { validateEnvVariables, formatJSONError } from "../lib/validation"
import { isWebSocketURL } from "./WebSocketPanel"
const GraphQLPanel = lazy(() => import("./GraphQLPanel").then(module => ({ default: module.GraphQLPanel })))
const WebSocketPanel = lazy(() => import("./WebSocketPanel").then(module => ({ default: module.WebSocketPanel })))

export const RequestTabs = memo(function RequestTabs({
    activeRequest,
    onUpdateField,
    variables,
    onUpdateVariables,
    response,
    EditorComponent,
    defaultTab = 'body'
}) {
    const [envVarValidation, setEnvVarValidation] = useState({ valid: true, error: null })

    const [activeTab, setActiveTab] = useState(defaultTab)

    useEffect(() => {
        setActiveTab(defaultTab)
    }, [defaultTab])

    useEffect(() => {
        const url = activeRequest?.url || ''
        if (isWebSocketURL(url) && activeTab !== 'websocket') {
            setActiveTab('websocket')
        }
    }, [activeRequest?.url])

    useEffect(() => {
        const result = validateEnvVariables(variables)
        setEnvVarValidation(result)
    }, [variables])

    const handleUrlChange = useCallback((newUrl) => onUpdateField('url', newUrl), [onUpdateField])
    const handleQueryParamsChange = useCallback((newParams) => onUpdateField('queryParams', newParams), [onUpdateField])

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
            <div className="border-b border-border/60 bg-muted/10 px-4">
                <TabsList>
                    <TabsTrigger value="body" icon={Braces}>Body</TabsTrigger>
                    <TabsTrigger value="graphql" icon={Zap}>GraphQL</TabsTrigger>
                    <TabsTrigger value="websocket" icon={Radio}>WebSocket</TabsTrigger>
                    <TabsTrigger value="params" icon={Hash}>Params</TabsTrigger>
                    <TabsTrigger value="headers" icon={Heading1}>Headers</TabsTrigger>
                    <TabsTrigger value="vars" icon={FolderOpen}>Env Vars</TabsTrigger>
                    <TabsTrigger value="test" icon={FlaskConical}>Extract</TabsTrigger>
                </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
                <TabsContent value="body" className="h-full p-0" noMargin>
                    <div className="h-full">
                        <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading editor...</div>}>
                            <EditorComponent
                                value={activeRequest.body}
                                onChange={(e) => onUpdateField('body', e.target.value)}
                                language="json"
                                placeholder='{\n  "key": "value"\n}'
                                className="min-h-[300px] font-mono text-sm"
                                height="100%"
                            />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="graphql" className="h-full p-0" noMargin>
                    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading GraphQL Module...</div>}>
                        <GraphQLPanel
                            query={activeRequest.graphqlQuery || ''}
                            variables={activeRequest.graphqlVariables || '{}'}
                            onQueryChange={(val) => onUpdateField('graphqlQuery', val)}
                            onVariablesChange={(val) => onUpdateField('graphqlVariables', val)}
                        />
                    </Suspense>
                </TabsContent>

                <TabsContent value="websocket" className="h-full p-0" noMargin>
                    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading WebSocket Module...</div>}>
                        <WebSocketPanel
                            url={activeRequest.wsUrl || activeRequest.url || ''}
                            onUrlChange={(val) => onUpdateField('wsUrl', val)}
                            headers={activeRequest.headers || '{}'}
                        />
                    </Suspense>
                </TabsContent>

                <TabsContent value="params" className="h-full p-0" noMargin>
                    <ParamsPanel
                        url={activeRequest?.url || ''}
                        queryParams={activeRequest?.queryParams || '{}'}
                        onUrlChange={handleUrlChange}
                        onQueryParamsChange={handleQueryParamsChange}
                    />
                </TabsContent>

                <TabsContent value="headers" className="h-full p-0" noMargin>
                    <div className="h-full">
                        <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading editor...</div>}>
                            <EditorComponent
                                value={activeRequest.headers}
                                onChange={(e) => onUpdateField('headers', e.target.value)}
                                language="json"
                                placeholder='{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer token"\n}'
                                className="min-h-[300px] font-mono text-sm"
                                height="100%"
                            />
                        </Suspense>
                    </div>
                </TabsContent>

                <TabsContent value="vars" className="h-full p-0" noMargin>
                    <div className="flex h-full flex-col">
                        <div className="flex-1 overflow-hidden relative">
                            <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading editor...</div>}>
                                <EditorComponent
                                    value={variables}
                                    onChange={(e) => onUpdateVariables(e.target.value)}
                                    language="json"
                                    placeholder='{\n  "base_url": "https://api.example.com"\n}'
                                    className="min-h-[200px] font-mono text-sm h-full resize-none p-4 bg-transparent border-0 focus-visible:ring-0"
                                    height="100%"
                                />
                            </Suspense>
                        </div>

                        <div className={`px-4 py-2 flex items-center gap-2 text-xs border-t ${envVarValidation.error ? 'bg-destructive/10 border-destructive/20' : 'bg-success/10 border-success/20'
                            }`}>
                            {envVarValidation.error ? (
                                <>
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                                    <span className="text-destructive truncate">{formatJSONError(envVarValidation)}</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                                    <span className="text-success dark:text-success">Valid JSON</span>
                                </>
                            )}
                        </div>

                    </div>
                </TabsContent>

                <TabsContent value="test" className="h-full p-0" noMargin>
                    <TestScriptsPanel
                        response={response}
                        variables={variables}
                        onVariablesChange={onUpdateVariables}
                    />
                </TabsContent>
            </div>
        </Tabs>
    )
})
