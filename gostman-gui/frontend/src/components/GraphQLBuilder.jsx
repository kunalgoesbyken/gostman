import { memo, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Network } from "lucide-react"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, PanelBody, SIDE_PANE, SectionLabel, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { VirtualList } from "./ui/VirtualList"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { BUILDER_TEXT, ROW_ARGUMENT, ROW_FIELD, ROW_FRAGMENT, buildRows, filterRows } from "../lib/graphqlBuilder"
import { firstOperation, parseQuery, setArgumentIncluded, setFieldSelected, setFragmentSelected } from "../lib/graphqlDocument"
import { buildIndex } from "../lib/graphqlModel"
import { cn } from "../lib/utils"

const ROW_HEIGHT_PX = 28
const INDENT_PX = 14
const BASE_INDENT_PX = 8
const FILTER_DEBOUNCE_MS = 150
const SUBSCRIPTION = "subscription"
const ROOTS = ["query", "mutation", "subscription"]
const NO_EXPANSION = new Map()

function rowText(row) {
  if (row.kind === ROW_FRAGMENT) return `… on ${row.name}`
  return row.kind === ROW_ARGUMENT ? `${row.name}:` : row.name
}

function BuilderRow({ row, disabled, onToggleOpen, onToggleSelected }) {
  const Chevron = row.open ? ChevronDown : ChevronRight
  const isArgument = row.kind === ROW_ARGUMENT
  const label = isArgument ? BUILDER_TEXT.include(row.name) : BUILDER_TEXT.select(row.name)
  const title = row.locked ? BUILDER_TEXT.viaFragment : [row.name, row.description].filter(Boolean).join("\n")
  return (
    <div
      style={{ height: ROW_HEIGHT_PX, paddingLeft: BASE_INDENT_PX + row.depth * INDENT_PX }}
      className="flex items-center gap-1.5 pr-2 text-xs hover:bg-accent"
    >
      {row.composite ? (
        <button
          type="button"
          aria-expanded={row.open}
          aria-label={row.open ? BUILDER_TEXT.collapse : BUILDER_TEXT.expand}
          onClick={() => onToggleOpen(row)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <Chevron className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <input
        type="checkbox"
        aria-label={label}
        checked={row.selected}
        disabled={disabled || row.locked}
        onChange={(event) => onToggleSelected(row, event.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-primary"
      />
      <span
        title={title}
        className={cn("min-w-0 truncate font-mono", row.deprecated && "line-through opacity-60", isArgument ? "text-muted-foreground" : "text-foreground")}
      >
        {rowText(row)}
      </span>
      <span className="ml-auto max-w-[45%] shrink-0 truncate font-mono text-2xs text-muted-foreground" title={row.label}>{row.label}</span>
    </div>
  )
}

function useBuilderState({ index, query, variables, onChange }) {
  const parsed = useMemo(() => parseQuery(query), [query])
  const lastDocument = useRef(null)
  if (parsed.document) lastDocument.current = parsed.document
  const document = lastDocument.current
  const operationKind = document && firstOperation(document)?.operation
  const [chosenRoot, setChosenRoot] = useState("")
  const roots = ROOTS.filter((candidate) => index.roots[candidate])
  const root = operationKind || (roots.includes(chosenRoot) ? chosenRoot : roots[0])
  const [expansion, setExpansion] = useState(NO_EXPANSION)

  const apply = (result) => result && onChange(result)
  const state = { query, variables }
  return {
    document,
    error: parsed.error,
    root,
    roots,
    expansion,
    chooseRoot: setChosenRoot,
    toggleOpen: (row) => setExpansion(new Map(expansion).set(row.key, !row.open)),
    toggleSelected(row, selected) {
      if (row.kind === ROW_FIELD) apply(setFieldSelected(state, index, root, row.path, row.field, selected))
      else if (row.kind === ROW_ARGUMENT) apply(setArgumentIncluded(state, index, root, row.path, row.field, row.argument, selected))
      else apply(setFragmentSelected(state, index, root, row.path, row.typeName, selected))
    },
  }
}

const GraphQLBuilderTree = memo(function GraphQLBuilderTree({ index, query, variables, onChange }) {
  const builder = useBuilderState({ index, query, variables, onChange })
  const [filter, setFilter] = useState("")
  const debouncedFilter = useDebouncedValue(filter, FILTER_DEBOUNCE_MS)
  const rows = useMemo(
    () => filterRows(buildRows(index, builder.root, builder.document, builder.expansion), debouncedFilter),
    [index, builder.root, builder.document, builder.expansion, debouncedFilter],
  )
  const hasRoot = Boolean(builder.root)
  const renderRow = (row) => (
    <BuilderRow
      key={row.key}
      row={row}
      disabled={Boolean(builder.error)}
      onToggleOpen={builder.toggleOpen}
      onToggleSelected={builder.toggleSelected}
    />
  )

  return (
    <>
      <Toolbar>
        <SegmentedControl
          label={BUILDER_TEXT.rootLabel}
          options={builder.roots.map((value) => ({ value, label: BUILDER_TEXT.rootNames[value] }))}
          value={builder.root}
          onChange={builder.chooseRoot}
        />
      </Toolbar>
      <Toolbar>
        <Input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={BUILDER_TEXT.filterPlaceholder}
          aria-label={BUILDER_TEXT.filterLabel}
          spellCheck={false}
        />
      </Toolbar>
      {builder.error && <Notice tone="warning">{BUILDER_TEXT.syntaxError(builder.error.message)}</Notice>}
      {builder.root === SUBSCRIPTION && <Notice>{BUILDER_TEXT.subscription}</Notice>}
      {hasRoot && rows.length > 0 && <VirtualList items={rows} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} className="min-h-0 flex-1 py-1" />}
      {hasRoot && rows.length === 0 && <p className="p-3 text-xs text-muted-foreground">{BUILDER_TEXT.empty}</p>}
      {!hasRoot && <p className="p-3 text-xs text-muted-foreground">{BUILDER_TEXT.noRoot}</p>}
    </>
  )
})

function BuilderContent({ schema, query, variables, onChange }) {
  const index = useMemo(() => (schema?.introspection ? buildIndex(schema.introspection) : null), [schema])
  if (index) return <GraphQLBuilderTree index={index} query={query} variables={variables} onChange={onChange} />
  if (schema?.loading) return <p className="p-3 text-xs text-muted-foreground">{BUILDER_TEXT.loading}</p>
  if (schema?.error) return <Notice tone="destructive">{schema.error}</Notice>
  return (
    <PanelBody>
      <EmptyState icon={Network} title={BUILDER_TEXT.noSchemaTitle} description={BUILDER_TEXT.noSchemaDescription} />
    </PanelBody>
  )
}

export function GraphQLBuilder({ schema, query, variables, onChange, onLoadSchema }) {
  return (
    <aside aria-label={BUILDER_TEXT.paneLabel} className={cn(SIDE_PANE, "w-1/2 min-w-64 max-w-md")}>
      <Toolbar>
        <SectionLabel className="flex-1">{BUILDER_TEXT.title}</SectionLabel>
        <Button variant="outline" size="sm" disabled={Boolean(schema?.loading)} onClick={onLoadSchema}>
          {schema?.introspection ? BUILDER_TEXT.refresh : BUILDER_TEXT.fetch}
        </Button>
      </Toolbar>
      <BuilderContent schema={schema} query={query} variables={variables} onChange={onChange} />
    </aside>
  )
}
