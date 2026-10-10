import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { parse, print } from "graphql"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { isPlainObject } from "../lib/dataUtils"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { parseVariableMap, substitutePlaceholders } from "../lib/placeholders"
import { cn } from "../lib/utils"

const QUERY_PLACEHOLDER = "query {\n  viewer {\n    id\n  }\n}"
const VARIABLES_PLACEHOLDER = '{\n  "id": "1"\n}'
const EMPTY_VARIABLES = ["", "{}"]
const SHOWN_TYPE_LIMIT = 100
const NO_VARIABLES = new Map()

const TOOLBAR = "flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4"
const TOOLBAR_LABEL = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
const TOOLBAR_BUTTON = "h-7 px-2"
const EDITOR = "h-full min-h-0 resize-none font-mono text-xs leading-relaxed"

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
  return <p className="shrink-0 break-words text-xs text-destructive">{children}</p>
}

function SchemaMembers({ members }) {
  if (members.length === 0) return <p className="pb-2 pl-5 text-xs text-muted-foreground">No fields.</p>
  return (
    <ul className="flex flex-col gap-1.5 pb-2 pl-5">
      {members.map((member) => (
        <li key={member.name}>
          <code className="break-words font-mono text-xs text-foreground/90">{member.signature}</code>
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
        title={type.description}
        className="flex w-full items-center gap-1.5 rounded py-1 text-left text-xs hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-mono text-foreground">{type.name}</span>
        <span className="ml-auto shrink-0 pr-1 text-[10px] text-muted-foreground">{type.label}</span>
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
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Search ${types.length} types and their fields`}
        aria-label="Search the schema"
        spellCheck={false}
        className="h-8 shrink-0 px-2 text-xs"
      />
      <ul className="min-h-0 flex-1 overflow-y-auto scrollbar-primary">
        {shown.map(({ type, hits }) => (
          <SchemaType
            key={type.name}
            type={type}
            hits={hits}
            isOpen={openName === type.name}
            onToggle={() => setOpenName(openName === type.name ? "" : type.name)}
          />
        ))}
        {matches.length === 0 && <li className="py-1 text-xs text-muted-foreground">Nothing matches.</li>}
        {matches.length > shown.length && (
          <li className="py-1 text-xs text-muted-foreground">
            {matches.length - shown.length} more types match. Narrow the search to see them.
          </li>
        )}
      </ul>
    </>
  )
}

function SchemaPane({ schema, onLoad }) {
  const isLoading = Boolean(schema?.loading)
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border/50">
      <div className={TOOLBAR}>
        <span className={TOOLBAR_LABEL}>Schema</span>
        <Button type="button" variant="outline" size="sm" className={TOOLBAR_BUTTON} disabled={isLoading} onClick={onLoad}>
          {schema?.types ? "Refresh" : "Fetch"}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
        {!schema && (
          <p className="text-xs text-muted-foreground">
            Fetch the schema to browse this endpoint's types and fields. The introspection query is sent with this request's URL, headers and auth.
          </p>
        )}
        {isLoading && <p className="text-xs text-muted-foreground">Fetching the schema...</p>}
        {schema?.error && <ErrorLine>{schema.error}</ErrorLine>}
        {schema?.types && <SchemaTypes types={schema.types} />}
      </div>
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
        className="flex h-8 shrink-0 items-center gap-1.5 border-t border-border/50 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={TOOLBAR_LABEL}>Variables (JSON)</span>
        {problem && <span className="min-w-0 truncate pl-2 text-xs text-destructive" title={problem}>{problem}</span>}
      </button>
      {isOpen && (
        <div className="h-24 min-h-[3rem] px-4 pb-3">
          <Textarea
            value={variables}
            onChange={(event) => onChange(event.target.value)}
            placeholder={VARIABLES_PLACEHOLDER}
            aria-label="GraphQL variables"
            aria-invalid={problem !== ""}
            spellCheck={false}
            className={cn(EDITOR, problem && "border-destructive/60")}
          />
        </div>
      )}
    </>
  )
}

export function GraphQLPanel({ query, variables, environment, schema, method, onQueryChange, onVariablesChange, onUseGraphQL, onLoadSchema }) {
  const [isSchemaOpen, setIsSchemaOpen] = useState(false)
  const [prettifyError, setPrettifyError] = useState("")

  const values = useMemo(() => parseVariableMap(environment) || NO_VARIABLES, [environment])
  const syntaxError = useMemo(() => querySyntaxError(substitutePlaceholders(query, values)), [query, values])
  const variablesError = useMemo(() => variablesProblem(substitutePlaceholders(variables, values)), [variables, values])
  const queryError = syntaxError || prettifyError

  const handleQueryChange = (next) => {
    setPrettifyError("")
    onQueryChange(next)
  }

  const prettify = () => {
    try {
      handleQueryChange(print(parse(query)))
    } catch (error) {
      setPrettifyError(`Cannot prettify: ${describeSyntaxError(error)}`)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={TOOLBAR}>
          <span className={TOOLBAR_LABEL}>Query</span>
          {method !== GRAPHQL_METHOD && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              Not sent while the method is {method}. Editing the query switches it to GRAPHQL.
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {method !== GRAPHQL_METHOD && (
              <Button type="button" variant="outline" size="sm" className={TOOLBAR_BUTTON} onClick={onUseGraphQL}>
                Send as GraphQL
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={TOOLBAR_BUTTON}
              disabled={query.trim() === ""}
              title="Reformat the query. Comments are removed."
              onClick={prettify}
            >
              Prettify
            </Button>
            <Button
              type="button"
              variant={isSchemaOpen ? "secondary" : "ghost"}
              size="sm"
              className={TOOLBAR_BUTTON}
              aria-pressed={isSchemaOpen}
              onClick={() => setIsSchemaOpen(!isSchemaOpen)}
            >
              Schema
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-primary">
          <div className="flex min-h-[7rem] flex-1 flex-col gap-2 px-4 py-3">
            <Textarea
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={QUERY_PLACEHOLDER}
              aria-label="GraphQL query"
              aria-invalid={queryError !== ""}
              spellCheck={false}
              className={cn(EDITOR, "flex-1", queryError && "border-destructive/60")}
            />
            {queryError && <ErrorLine>{queryError}</ErrorLine>}
          </div>
          <VariablesSection variables={variables} problem={variablesError} onChange={onVariablesChange} />
        </div>
      </div>
      {isSchemaOpen && <SchemaPane schema={schema} onLoad={onLoadSchema} />}
    </div>
  )
}
