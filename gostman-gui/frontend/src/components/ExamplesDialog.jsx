import { Suspense, useMemo, useState } from "react"
import { Bookmark, FileDigit, List, Pencil, Star, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { DataTable } from "./ui/dataTable"
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { SPLIT_LIST, SPLIT_PANES, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { TabCount } from "./ui/tabs"
import { EditorSkeleton } from "./ui/skeleton"
import { formatSize } from "../lib/dataUtils"
import { exampleSize, isBinaryExample, parseExamples, servedByDefault } from "../lib/examples"
import { statusVariant } from "../lib/response"
import { cn } from "../lib/utils"

const VIEW_BODY = "body"
const VIEW_HEADERS = "headers"
const EMPTY_HINT = "Send the request, then choose Save as example in the response panel. The mock server answers with these."
const FALLBACK_LANGUAGE = "plaintext"
const LANGUAGES = ["json", "html", "xml"]

const HEADER_COLUMNS = [
  { header: "Name", key: "key", width: "w-1/3", cellClassName: "text-foreground" },
  { header: "Value", key: "value" },
]

const languageOf = (contentType) => LANGUAGES.find((language) => contentType.includes(language)) || FALLBACK_LANGUAGE

function StatusBadge({ status }) {
  return <Badge variant={statusVariant({ statusCode: status })} className="font-mono">{status}</Badge>
}

function ExampleRow({ example, isSelected, isDefault, onSelect }) {
  return (
    <li>
      <button
        type="button"
        aria-current={isSelected}
        title={example.name}
        onClick={onSelect}
        className={cn(
          "flex h-8 w-full items-center gap-2 px-3 text-left text-xs",
          isSelected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <StatusBadge status={example.status} />
        <span className="min-w-0 flex-1 truncate">{example.name}</span>
        {isDefault && <Star aria-label="Served by default" className="h-3 w-3 shrink-0" />}
      </button>
    </li>
  )
}

function ExampleBody({ example, draft, onDraftChange, EditorComponent }) {
  if (isBinaryExample(example)) {
    return (
      <EmptyState
        icon={FileDigit}
        title={`Binary body, ${formatSize(exampleSize(example))}`}
        description="It cannot be edited as text and is served exactly as stored."
      />
    )
  }
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorComponent
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        language={languageOf(example.contentType)}
        path={`examples/${example.id}`}
        height="100%"
        surface="body"
      />
    </Suspense>
  )
}

function ExampleDetail({ example, isDefault, draft, onDraftChange, actions, EditorComponent }) {
  const [view, setView] = useState(VIEW_BODY)
  const isEdited = draft !== example.body
  const summary = `${example.contentType || "No content type"} · ${formatSize(exampleSize(example))}`
  const views = [
    { value: VIEW_BODY, label: "Body" },
    { value: VIEW_HEADERS, label: `Headers (${example.headers.length})` },
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Toolbar>
        <SegmentedControl label="Example section" options={views} value={view} onChange={setView} />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <StatusBadge status={example.status} />
          <span title={summary} className="min-w-0 truncate font-mono text-2xs text-muted-foreground">{summary}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={isDefault ? "Served by default" : "Serve by default"}
            icon={Star}
            disabled={isDefault}
            onClick={() => actions.markDefault(example)}
          />
          <IconButton label="Rename example" icon={Pencil} onClick={() => actions.rename(example)} />
          <IconButton label="Delete example" icon={Trash2} onClick={() => actions.remove(example)} />
        </div>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere]">
        {view === VIEW_BODY && (
          <ExampleBody example={example} draft={draft} onDraftChange={onDraftChange} EditorComponent={EditorComponent} />
        )}
        {view === VIEW_HEADERS && example.headers.length > 0 && <DataTable columns={HEADER_COLUMNS} rows={example.headers} />}
        {view === VIEW_HEADERS && example.headers.length === 0 && (
          <EmptyState icon={List} title="No headers" description="This example was saved without headers." />
        )}
      </div>
      {isEdited && (
        <DialogFooter>
          <p className="mr-auto min-w-0 self-center truncate text-xs text-muted-foreground">The body has unsaved changes.</p>
          <Button variant="outline" onClick={() => onDraftChange(example.body)}>Discard</Button>
          <Button onClick={() => actions.saveBody(example, draft)}>Save body</Button>
        </DialogFooter>
      )}
    </div>
  )
}

export function ExamplesDialog({ request, actions, EditorComponent }) {
  const [selectedId, setSelectedId] = useState("")
  const [drafts, setDrafts] = useState({})

  const examples = useMemo(() => parseExamples(request.examples), [request.examples])
  const selected = examples.find((example) => example.id === selectedId) || examples[0]
  const defaultId = servedByDefault(examples)?.id

  return (
    <Dialog label="Examples" size="lg" onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>Examples</DialogTitle>
        <TabCount>{examples.length}</TabCount>
        <span title={request.name} className="min-w-0 truncate text-xs text-muted-foreground">{request.name}</span>
      </DialogHeader>
      {selected ? (
        <div className={SPLIT_PANES}>
          <ul aria-label="Saved examples" className={cn(SPLIT_LIST, "w-56 overflow-y-auto py-1")}>
            {examples.map((example) => (
              <ExampleRow
                key={example.id}
                example={example}
                isSelected={example.id === selected.id}
                isDefault={example.id === defaultId}
                onSelect={() => setSelectedId(example.id)}
              />
            ))}
          </ul>
          <ExampleDetail
            key={selected.id}
            example={selected}
            isDefault={selected.id === defaultId}
            draft={drafts[selected.id] ?? selected.body}
            onDraftChange={(body) => setDrafts((current) => ({ ...current, [selected.id]: body }))}
            actions={actions}
            EditorComponent={EditorComponent}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <EmptyState icon={Bookmark} title="No examples yet" description={EMPTY_HINT} />
        </div>
      )}
    </Dialog>
  )
}
