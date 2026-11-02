import { useMemo, useRef, useState } from "react"
import { AlertTriangle, BookOpen, FileCode, FilePlus, GitCompare, PanelRight, PanelRightClose, Save, Server, ShieldCheck } from "lucide-react"
import { Button, IconButton } from "../ui/button"
import { Input } from "../ui/input"
import { ResizablePane } from "../ui/panel"
import { SegmentedControl } from "../ui/segmented"
import { CodeEditor } from "../CodeEditor"
import { EDITOR_BROWSER_TABS, SpecBrowserBody, SpecBrowserTabs, useSpecBrowser } from "../SpecBrowser"
import { SpecLint } from "../SpecLint"
import { EDGE_START } from "../../hooks/usePaneResize"
import { useDebouncedValue } from "../../hooks/useDebouncedValue"
import { useShortcutLabel } from "../../hooks/useShortcuts"
import { useSpecLint } from "../../hooks/useSpecLint"
import { SPEC_EDITOR_PANE } from "../../lib/layout"
import { isSpecDirty, specSource } from "../../lib/specDocument"
import { specDiagnostics, findingOffset } from "../../lib/specDiagnostics"
import { SPEC_VIEW_TEXT as TEXT } from "../../lib/specEditorText"
import { specExtensions } from "../../lib/specEditorExtensions"
import { linkedFolderId } from "../../lib/specLinked"
import { targetOffset } from "../../lib/specLocate"
import { hintWithShortcut } from "../../lib/shortcuts"
import { cn } from "../../lib/utils"
import { useAppStore } from "../../store/appStore"

const ANALYSIS_DELAY_MS = 500

const formatOptions = () => [
  { value: "yaml", label: TEXT.formatYaml },
  { value: "json", label: TEXT.formatJson },
]

function ToolbarButton({ icon: Icon, label, hint, onClick, variant = "ghost" }) {
  return (
    <Button variant={variant} size="sm" title={hint} onClick={onClick}>
      <Icon />
      <span className="max-xl:hidden">{label}</span>
    </Button>
  )
}

function SpecToolbar({ tab, spec, isDirty, isLinked, isPreviewOpen, actions, onTogglePreview }) {
  const saveShortcut = useShortcutLabel("saveRequest")
  const rename = (event) => actions.updateDraft(tab.id, { ...spec, name: event.target.value })
  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1">
      <FileCode aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input value={spec.name} aria-label={TEXT.nameLabel} onChange={rename} className="h-7 max-w-xs border-transparent text-sm font-medium hover:border-input focus:border-input" />
      {isDirty && <span aria-label={TEXT.unsaved} title={TEXT.unsaved} className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />}
      <SegmentedControl label={TEXT.formatLabel} options={formatOptions()} value={spec.format} onChange={(format) => actions.convert(tab.id, format)} />
      <div className="ms-auto flex shrink-0 flex-wrap items-center gap-1">
        <ToolbarButton icon={BookOpen} label={TEXT.viewDocs} hint={TEXT.viewDocsHint} onClick={() => actions.viewDocs(tab.id)} />
        <ToolbarButton icon={FilePlus} label={isLinked ? TEXT.update : TEXT.generate} hint={isLinked ? TEXT.updateHint : TEXT.generateHint} onClick={() => actions.generate(tab.id)} />
        {actions.startMock && <ToolbarButton icon={Server} label={TEXT.mock} hint={TEXT.mockHint} onClick={() => actions.startMock(tab.id)} />}
        <ToolbarButton icon={ShieldCheck} label={TEXT.check} hint={TEXT.checkHint} onClick={() => actions.checkResponses(tab.id)} />
        <ToolbarButton icon={GitCompare} label={TEXT.compare} hint={TEXT.compareHint} onClick={() => actions.compare(tab.id)} />
        <IconButton label={isPreviewOpen ? TEXT.hidePreview : TEXT.showPreview} icon={isPreviewOpen ? PanelRightClose : PanelRight} mirrored onClick={onTogglePreview} />
        <Button size="sm" disabled={!isDirty} onClick={() => actions.save(tab.id)} title={hintWithShortcut(TEXT.save, saveShortcut)}>
          <Save />
          <span className="max-sm:hidden">{TEXT.save}</span>
        </Button>
      </div>
    </div>
  )
}

function problemsHeading(lint) {
  if (lint.isChecking) return TEXT.checking
  if (lint.error) return TEXT.cannotRead
  return TEXT.problems(lint.report.findings.length)
}

function Problems({ lint, onSelect }) {
  return (
    <section aria-label={TEXT.problemsLabel} className="flex h-44 shrink-0 flex-col border-t border-border">
      <h3 className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-3 text-xs font-medium">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
        {problemsHeading(lint)}
      </h3>
      {lint.error && <p role="alert" className="overflow-y-auto p-3 text-xs text-destructive [overflow-wrap:anywhere]">{lint.error}</p>}
      {lint.report && <SpecLint report={lint.report} onSelectFinding={onSelect} />}
    </section>
  )
}

export function SpecView({ tab, actions }) {
  const spec = tab.specDraft
  const saved = useAppStore((state) => state.specs.find((candidate) => candidate.id === tab.specId))
  const isLinked = useAppStore((state) => Boolean(linkedFolderId(state, tab.specId)))
  const isDirty = isSpecDirty(spec, saved)
  const editorRef = useRef(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const analysedText = useDebouncedValue(spec.text, ANALYSIS_DELAY_MS)
  const source = useMemo(() => specSource({ text: analysedText }), [analysedText])
  const lint = useSpecLint(source, actions.browser.lint)
  const diagnostics = useMemo(() => ({ text: lint.text, items: specDiagnostics(lint.text, lint.report?.findings ?? []) }), [lint])
  const extensions = useMemo(() => specExtensions(spec.format), [spec.format])
  const browser = useSpecBrowser({
    source,
    actions: actions.browser,
    onReveal: (target) => editorRef.current?.reveal(targetOffset(spec.text, target)),
  })

  const change = (event) => actions.updateDraft(tab.id, { ...spec, text: event.target.value })
  const revealFinding = (finding) => editorRef.current?.reveal(findingOffset(lint.text, finding))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SpecToolbar tab={tab} spec={spec} isDirty={isDirty} isLinked={isLinked} isPreviewOpen={isPreviewOpen} actions={actions} onTogglePreview={() => setIsPreviewOpen((open) => !open)} />
      <div className="flex min-h-0 flex-1 max-sm:flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CodeEditor
              ref={editorRef}
              path={tab.id}
              value={spec.text}
              language={spec.format}
              height="100%"
              label={TEXT.editorLabel}
              extensions={extensions}
              diagnostics={diagnostics}
              onChange={change}
            />
          </div>
          <Problems lint={lint} onSelect={revealFinding} />
        </div>
        {isPreviewOpen && (
          <ResizablePane pane={SPEC_EDITOR_PANE} edge={EDGE_START} as="section" aria-label={TEXT.previewLabel} className={cn("flex min-h-0 shrink-0 flex-col border-s border-border max-sm:h-1/2 max-sm:w-full sm:relative sm:w-[var(--pane-width)]")}>
            <div className="flex h-9 shrink-0 items-center border-b border-border px-2">
              <SpecBrowserTabs browser={browser} tabs={EDITOR_BROWSER_TABS} />
            </div>
            <SpecBrowserBody browser={browser} />
          </ResizablePane>
        )}
      </div>
    </div>
  )
}
