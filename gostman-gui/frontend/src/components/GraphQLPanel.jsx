import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Network } from "lucide-react"
import { parse, print } from "graphql"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, Panel, PanelBody, SIDE_PANE, SectionLabel, Toolbar } from "./ui/panel"
import { Textarea } from "./ui/textarea"
import { GraphQLBuilder } from "./GraphQLBuilder"
import { isPlainObject } from "../lib/dataUtils"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { parseVariableMap, substitutePlaceholders } from "../lib/placeholders"
import { cn } from "../lib/utils"

const QUERY_PLACEHOLDER = "query {\n  viewer {\n    id\n  }\n}"
const VARIABLES_PLACEHOLDER = '{\n  "id": "1"\n}'
const EMPTY_VARIABLES = ["", "{}"]
const SHOWN_TYPE_LIMIT = 100
const NO_VARIABLES = new Map()
const INVALID_FIELD = "border-destructive"
const PANE_SCHEMA = "schema"
const PANE_BUILDER = "builder"

function describeSyntaxError(error) {
  const location = error.locations?.[0]
  return location ? `${error.message} (line ${location.line}, column ${location.column})` : error.message
}

function querySyntaxError(query) {
  if (query.trim() === "") return ""
  try {
    parse(query)
    return ""
  } catch (error) {
    return describeSyntaxError(error)
  }
}

function variablesProblem(variables) {
  if (variables.trim() === "") return ""
  try {
    return isPlainObject(JSON.parse(variables)) ? "" : "Variables must be a JSON object."
  } catch (error) {
    return `Not valid JSON: ${error.message}`
  }
}

function matchTypes(types, search) {
  const needle = search.trim().toLowerCase()
  if (needle === "") return types.map((type) => ({ type, hits: [] }))
  return types.flatMap((type) => {
    if (type.name.toLowerCase().includes(needle)) return [{ type, hits: [] }]
    const hits = type.members.filter((member) => member.name.toLowerCase().includes(needle))
    return hits.length > 0 ? [{ type, hits }] : []
  })
}

function ErrorLine({ children }) {
  return <p role="alert" title={children} className="shrink-0 truncate text-xs text-destructive">{children}</p>
}

function SchemaMembers({ members }) {
  if (members.length === 0) return <p className="pb-2 pl-5 text-xs text-muted-foreground">No fields.</p>
  return (
    <ul className="flex flex-col gap-1.5 pb-2 pl-5">
      {members.map((member) => (
        <li key={member.name}>
          <code className="font-mono text-xs text-foreground">{member.signature}</code>
          {member.description && <p className="text-xs text-muted-foreground">{member.description}</p>}
        </li>
      ))}
    </ul>
  )
}

function SchemaType({ type, hits, isOpen, onToggle }) {
  const Chevron = isOpen ? ChevronDown : ChevronRight
  const members = isOpen ? type.members : hits
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        title={type.description ? `${type.name}\n${type.description}` : type.name}
        className="flex h-7 w-full items-center gap-1.5 rounded px-1 text-left text-xs hover:bg-accent"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">{type.name}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{type.label}</span>
      </button>
      {(isOpen || hits.length > 0) && <SchemaMembers members={members} />}
    </li>
  )
}

function SchemaTypes({ types }) {
  const [search, setSearch] = useState("")
  const [openName, setOpenName] = useState("")
  const matches = useMemo(() => matchTypes(types, search), [types, search])
  const shown = matches.slice(0, SHOWN_TYPE_LIMIT)

  return (
    <>
      <Toolbar>
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${types.length} types and fields`}
          aria-label="Search the schema"
          spellCheck={false}
        />
      </Toolbar>
      <ul className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 [overflow-wrap:anywhere]">
        {shown.map(({ type, hits }) => (
          <SchemaType
            key={type.name}
            type={type}
            hits={hits}
            isOpen={openName === type.name}
            onToggle={() => setOpenName(openName === type.name ? "" : type.name)}
          />
        ))}
        {matches.length === 0 && <li className="p-1 text-xs text-muted-foreground">Nothing matches.</li>}
        {matches.length > shown.length && (
          <li className="p-1 text-xs text-muted-foreground">
            {matches.length - shown.length} more types match. Narrow the search to see them.
          </li>
        )}
      </ul>
    </>
  )
}

function SchemaContent({ schema }) {
  if (schema?.types) return <SchemaTypes types={schema.types} />
  if (schema?.loading) return <p className="p-3 text-xs text-muted-foreground">Fetching the schema</p>
  if (schema?.error) return <Notice tone="destructive">{schema.error}</Notice>
  return (
    <PanelBody>
      <EmptyState
        icon={Network}
        title="No schema loaded"
        description="Fetch it to browse this endpoint's types and fields. The introspection query uses this request's URL, headers and auth."
      />
    </PanelBody>
  )
}

function SchemaPane({ schema, onLoad }) {
  return (
    <aside aria-label="Schema" className={cn(SIDE_PANE, "w-2/5 min-w-52 max-w-80")}>
      <Toolbar>
        <SectionLabel className="flex-1">Schema</SectionLabel>
        <Button variant="outline" size="sm" disabled={Boolean(schema?.loading)} onClick={onLoad}>
          {schema?.types ? "Refresh" : "Fetch"}
        </Button>
      </Toolbar>
      <SchemaContent schema={schema} />
    </aside>
  )
}

function VariablesSection({ variables, problem, onChange }) {
  const [isOpen, setIsOpen] = useState(!EMPTY_VARIABLES.includes(variables.trim()))
  const Chevron = isOpen ? ChevronDown : ChevronRight

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex h-10 shrink-0 items-center gap-1.5 border-t border-border px-3 text-left"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SectionLabel>Variables (JSON)</SectionLabel>
        {problem && <span className="min-w-0 truncate pl-2 text-xs text-destructive" title={problem}>{problem}</span>}
      </button>
      {isOpen && (
        <div className="min-h-11 flex-1 px-3 pb-3 pt-1">
          <Textarea
            value={variables}
            onChange={(event) => onChange(event.target.value)}
            placeholder={VARIABLES_PLACEHOLDER}
            aria-label="GraphQL variables"
            aria-invalid={problem !== ""}
            className={cn("h-full", problem && INVALID_FIELD)}
          />
        </div>
      )}
    </>
  )
}

export function GraphQLPanel({ query, variables, environment, schema, method, onQueryChange, onVariablesChange, onUseGraphQL, onLoadSchema }) {
  const [pane, setPane] = useState("")
  const [prettifyError, setPrettifyError] = useState("")

  const values = useMemo(() => parseVariableMap(environment) || NO_VARIABLES, [environment])
  const syntaxError = useMemo(() => querySyntaxError(substitutePlaceholders(query, values)), [query, values])
  const variablesError = useMemo(() => variablesProblem(substitutePlaceholders(variables, values)), [variables, values])
  const queryError = syntaxError || prettifyError
  const isGraphQL = method === GRAPHQL_METHOD

  const handleQueryChange = (next) => {
    setPrettifyError("")
    onQueryChange(next)
  }

  const togglePane = (name) => setPane(pane === name ? "" : name)

  const applyBuilderChange = (result) => {
    handleQueryChange(result.query)
    if (result.variables !== variables) onVariablesChange(result.variables)
  }

  const prettify = () => {
    try {
      handleQueryChange(print(parse(query)))
    } catch (error) {
      setPrettifyError(`Cannot prettify: ${describeSyntaxError(error)}`)
    }
  }

  return (
    <div className="relative flex h-full min-h-0">
      <Panel className="flex-1">
        <Toolbar>
          <SectionLabel className="flex-1">Query</SectionLabel>
          {!isGraphQL && <Button variant="outline" size="sm" onClick={onUseGraphQL}>Send as GraphQL</Button>}
          <Button
            variant="ghost"
            size="sm"
            disabled={query.trim() === ""}
            title="Reformat the query. Comments are removed."
            onClick={prettify}
          >
            Prettify
          </Button>
          <Button
            variant={pane === PANE_BUILDER ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={pane === PANE_BUILDER}
            onClick={() => togglePane(PANE_BUILDER)}
          >
            Builder
          </Button>
          <Button
            variant={pane === PANE_SCHEMA ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={pane === PANE_SCHEMA}
            onClick={() => togglePane(PANE_SCHEMA)}
          >
            Schema
          </Button>
        </Toolbar>
        <div className="flex min-h-[4.25rem] flex-[2] flex-col gap-1 p-3">
          <Textarea
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={QUERY_PLACEHOLDER}
            aria-label="GraphQL query"
            aria-invalid={queryError !== ""}
            className={cn("min-h-0 flex-1", queryError && INVALID_FIELD)}
          />
          {queryError && <ErrorLine>{queryError}</ErrorLine>}
          {!isGraphQL && !queryError && (
            <p className="shrink-0 truncate text-xs text-muted-foreground" title={`Not sent while the method is ${method}.`}>
              Not sent while the method is {method}.
            </p>
          )}
        </div>
        <VariablesSection variables={variables} problem={variablesError} onChange={onVariablesChange} />
      </Panel>
      {pane === PANE_SCHEMA && <SchemaPane schema={schema} onLoad={onLoadSchema} />}
      {pane === PANE_BUILDER && (
        <GraphQLBuilder schema={schema} query={query} variables={variables} onChange={applyBuilderChange} onLoadSchema={onLoadSchema} />
      )}
    </div>
  )
}
