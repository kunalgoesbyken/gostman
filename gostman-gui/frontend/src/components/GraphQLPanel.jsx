import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Network } from "lucide-react"
import { parse, print } from "graphql"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, Panel, PanelBody, ResizablePane, SIDE_PANE, SectionLabel, Toolbar } from "./ui/panel"
import { EDGE_START } from "../hooks/usePaneResize"
import { GRAPHQL_SCHEMA_PANE } from "../lib/layout"
import { Textarea } from "./ui/textarea"
import { SkeletonLines } from "./ui/skeleton"
import { GraphQLBuilder } from "./GraphQLBuilder"
import { isPlainObject } from "../lib/dataUtils"
import { BUILDER_TEXT } from "../lib/graphqlBuilderText"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { GRAPHQL_TEXT as TEXT } from "../lib/graphqlText"
import { parseVariableMap, substitutePlaceholders } from "../lib/placeholders"
import { cn } from "../lib/utils"

const EMPTY_VARIABLES = ["", "{}"]
const SHOWN_TYPE_LIMIT = 100
const NO_VARIABLES = new Map()
const INVALID_FIELD = "border-destructive"
const PANE_SCHEMA = "schema"
const PANE_BUILDER = "builder"

function describeSyntaxError(error) {
  const location = error.locations?.[0]
  return location ? TEXT.syntaxAt(error.message, location.line, location.column) : error.message
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
    return isPlainObject(JSON.parse(variables)) ? "" : TEXT.variablesNotObject
  } catch (error) {
    return TEXT.invalidJson(error.message)
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
  if (members.length === 0) return <p className="pb-2 ps-5 text-xs text-muted-foreground">{TEXT.noFields}</p>
  return (
    <ul className="flex flex-col gap-1.5 pb-2 ps-5">
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
        className="flex h-7 w-full items-center gap-1.5 rounded px-1 text-start text-xs hover:bg-accent"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
        <span className="min-w-0 flex-1 truncate font-mono text-foreground">{type.name}</span>
        <span className="shrink-0 text-2xs text-muted-foreground">{type.label}</span>
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
          placeholder={TEXT.searchPlaceholder(types.length)}
          aria-label={TEXT.searchLabel}
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
        {matches.length === 0 && <li className="p-1 text-xs text-muted-foreground">{TEXT.noMatch}</li>}
        {matches.length > shown.length && (
          <li className="p-1 text-xs text-muted-foreground">{TEXT.moreMatches(matches.length - shown.length)}</li>
        )}
      </ul>
    </>
  )
}

function SchemaContent({ schema }) {
  if (schema?.types) return <SchemaTypes types={schema.types} />
  if (schema?.loading) return <SkeletonLines label={BUILDER_TEXT.loading} lines={6} />
  if (schema?.error) return <Notice tone="destructive">{schema.error}</Notice>
  return (
    <PanelBody>
      <EmptyState icon={Network} title={BUILDER_TEXT.noSchemaTitle} description={TEXT.schemaDescription} />
    </PanelBody>
  )
}

function SchemaPane({ schema, onLoad }) {
  return (
    <ResizablePane as="aside" pane={GRAPHQL_SCHEMA_PANE} edge={EDGE_START} aria-label={TEXT.schema} className={SIDE_PANE}>
      <Toolbar>
        <SectionLabel className="flex-1">{TEXT.schema}</SectionLabel>
        <Button variant="outline" size="sm" disabled={Boolean(schema?.loading)} onClick={onLoad}>
          {schema?.types ? BUILDER_TEXT.refresh : BUILDER_TEXT.fetch}
        </Button>
      </Toolbar>
      <SchemaContent schema={schema} />
    </ResizablePane>
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
        className="flex h-10 shrink-0 items-center gap-1.5 border-t border-border px-3 text-start"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />
        <SectionLabel>{TEXT.variables}</SectionLabel>
        {problem && <span className="min-w-0 truncate ps-2 text-xs text-destructive" title={problem}>{problem}</span>}
      </button>
      {isOpen && (
        <div className="min-h-11 flex-1 px-3 pb-3 pt-1">
          <Textarea
            dir="ltr"
            value={variables}
            onChange={(event) => onChange(event.target.value)}
            placeholder={TEXT.variablesPlaceholder}
            aria-label={TEXT.variablesLabel}
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
      setPrettifyError(TEXT.cannotPrettify(describeSyntaxError(error)))
    }
  }

  return (
    <div className="relative flex h-full min-h-0">
      <Panel className="flex-1">
        <Toolbar>
          <SectionLabel className="flex-1">{TEXT.query}</SectionLabel>
          {!isGraphQL && <Button variant="outline" size="sm" onClick={onUseGraphQL}>{TEXT.sendAsGraphql}</Button>}
          <Button
            variant="outline"
            size="sm"
            disabled={query.trim() === ""}
            title={TEXT.prettifyTitle}
            onClick={prettify}
          >
            {TEXT.prettify}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={pane === PANE_BUILDER}
            onClick={() => togglePane(PANE_BUILDER)}
          >
            {BUILDER_TEXT.title}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={pane === PANE_SCHEMA}
            onClick={() => togglePane(PANE_SCHEMA)}
          >
            {TEXT.schema}
          </Button>
        </Toolbar>
        <div className="flex min-h-[4.25rem] flex-[2] flex-col gap-1 p-3">
          <Textarea
            dir="ltr"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder={TEXT.queryPlaceholder}
            aria-label={TEXT.queryLabel}
            aria-invalid={queryError !== ""}
            className={cn("min-h-0 flex-1", queryError && INVALID_FIELD)}
          />
          {queryError && <ErrorLine>{queryError}</ErrorLine>}
          {!isGraphQL && !queryError && (
            <p className="shrink-0 truncate text-xs text-muted-foreground" title={TEXT.notSent(method)}>
              {TEXT.notSent(method)}
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
