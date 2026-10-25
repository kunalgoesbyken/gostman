import { Suspense, useMemo, useRef, useState } from "react"
import { Bookmark, Braces, FileDigit, List, Pencil, Star, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { DataTable } from "./ui/dataTable"
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { SPLIT_LIST, SPLIT_PANES, Toolbar } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { TabCount } from "./ui/tabs"
import { EditorSkeleton } from "./ui/skeleton"
import { canFormat } from "../lib/codeEditor"
import { formatBytes } from "../lib/byteSize"
import { exampleSize, isBinaryExample, parseExamples, servedByDefault } from "../lib/examples"
import { EXAMPLES_TEXT } from "../lib/examplesText"
import { statusVariant } from "../lib/response"
import { RESPONSE_TEXT } from "../lib/responseText"
import { cn } from "../lib/utils"

const VIEW_BODY = "body"
const VIEW_HEADERS = "headers"
const FALLBACK_LANGUAGE = "plaintext"
const LANGUAGES = ["json", "html", "xml"]

const HEADER_COLUMNS = [
  { get header() { return RESPONSE_TEXT.columns.name }, key: "key", width: "w-1/3", cellClassName: "text-foreground" },
  { get header() { return RESPONSE_TEXT.columns.value }, key: "value" },
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
          "flex h-8 w-full items-center gap-2 px-3 text-start text-xs",
          isSelected ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <StatusBadge status={example.status} />
        <span className="min-w-0 flex-1 truncate">{example.name}</span>
        {isDefault && <Star aria-label={EXAMPLES_TEXT.servedByDefault} className="h-3 w-3 shrink-0" />}
      </button>
    </li>
  )
}

const ignoreFormatResult = () => {}

const isFormattable = (example) => !isBinaryExample(example) && canFormat(languageOf(example.contentType))

function ExampleBody({ example, draft, editorRef, onDraftChange, EditorComponent }) {
  if (isBinaryExample(example)) {
    return (
      <EmptyState
        icon={FileDigit}
        title={EXAMPLES_TEXT.binaryTitle(formatBytes(exampleSize(example)))}
        description={EXAMPLES_TEXT.binaryHint}
      />
    )
  }
  return (
    <div dir="ltr" className="contents">
      <Suspense fallback={<EditorSkeleton />}>
        <EditorComponent
          ref={editorRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onFormat={ignoreFormatResult}
          language={languageOf(example.contentType)}
          path={`examples/${example.id}`}
          height="100%"
          surface="body"
          label={EXAMPLES_TEXT.bodyLabel}
        />
      </Suspense>
    </div>
  )
}

function ExampleDetail({ example, isDefault, draft, onDraftChange, actions, EditorComponent }) {
  const [view, setView] = useState(VIEW_BODY)
  const editorRef = useRef(null)
  const isEdited = draft !== example.body
  const summary = EXAMPLES_TEXT.summary(example.contentType || EXAMPLES_TEXT.noContentType, formatBytes(exampleSize(example)))
  const views = [
    { value: VIEW_BODY, label: EXAMPLES_TEXT.body },
    { value: VIEW_HEADERS, label: EXAMPLES_TEXT.headersCount(example.headers.length) },
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Toolbar>
        <SegmentedControl label={EXAMPLES_TEXT.section} options={views} value={view} onChange={setView} />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <StatusBadge status={example.status} />
          <span title={summary} className="min-w-0 truncate font-mono text-2xs text-muted-foreground">{summary}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {view === VIEW_BODY && isFormattable(example) && (
            <IconButton label={EXAMPLES_TEXT.format} icon={Braces} disabled={draft.trim() === ""} onClick={() => editorRef.current?.format()} />
          )}
          <IconButton
            label={isDefault ? EXAMPLES_TEXT.servedByDefault : EXAMPLES_TEXT.serveByDefault}
            icon={Star}
            disabled={isDefault}
            onClick={() => actions.markDefault(example)}
          />
          <IconButton label={EXAMPLES_TEXT.rename} icon={Pencil} onClick={() => actions.rename(example)} />
          <IconButton label={EXAMPLES_TEXT.remove} icon={Trash2} onClick={() => actions.remove(example)} />
        </div>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere]">
        {view === VIEW_BODY && (
          <ExampleBody example={example} draft={draft} editorRef={editorRef} onDraftChange={onDraftChange} EditorComponent={EditorComponent} />
        )}
        {view === VIEW_HEADERS && example.headers.length > 0 && <DataTable columns={HEADER_COLUMNS} rows={example.headers} />}
        {view === VIEW_HEADERS && example.headers.length === 0 && (
          <EmptyState icon={List} title={RESPONSE_TEXT.noHeadersTitle} description={EXAMPLES_TEXT.noHeadersHint} />
        )}
      </div>
      {isEdited && (
        <DialogFooter>
          <p className="me-auto min-w-0 self-center truncate text-xs text-muted-foreground">{EXAMPLES_TEXT.unsaved}</p>
          <Button variant="outline" onClick={() => onDraftChange(example.body)}>{EXAMPLES_TEXT.discard}</Button>
          <Button onClick={() => actions.saveBody(example, draft)}>{EXAMPLES_TEXT.saveBody}</Button>
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
    <Dialog label={EXAMPLES_TEXT.title} size="lg" onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{EXAMPLES_TEXT.title}</DialogTitle>
        <TabCount>{examples.length}</TabCount>
        <span title={request.name} className="min-w-0 truncate text-xs text-muted-foreground">{request.name}</span>
      </DialogHeader>
      {selected ? (
        <div className={SPLIT_PANES}>
          <ul aria-label={EXAMPLES_TEXT.listLabel} className={cn(SPLIT_LIST, "w-56 overflow-y-auto py-1")}>
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
          <EmptyState icon={Bookmark} title={EXAMPLES_TEXT.emptyTitle} description={EXAMPLES_TEXT.emptyHint} />
        </div>
      )}
    </Dialog>
  )
}
