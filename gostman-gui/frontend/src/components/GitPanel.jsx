import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, CloudDownload, GitBranch, GitMerge, History, Minus, Plus, ShieldAlert, Undo2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Notice, SectionLabel } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { ConflictEditor } from "./ConflictEditor"
import { GitDiffView } from "./GitDiffView"
import { BranchesTab, HistoryTab, RemotesTab, StashesTab } from "./GitTabs"
import { pluralize } from "../lib/dataUtils"
import { TAB_BRANCHES, TAB_CHANGES, TAB_HISTORY, TAB_REMOTES, TAB_STASHES, hasWorktreeChange, isStaged, useGitStore } from "../lib/gitSession"

const TABS = [
  { value: TAB_CHANGES, label: "Changes" },
  { value: TAB_BRANCHES, label: "Branches" },
  { value: TAB_STASHES, label: "Stashes" },
  { value: TAB_HISTORY, label: "History" },
  { value: TAB_REMOTES, label: "Remotes" },
]
const RESTRICTED_NOTICE = "This folder is not trusted yet, so Git is read-only: you can look at changes but not initialize, stage, commit or sync."
const MERGE_NOTICE = "A merge is in progress. Resolve each conflicted file, then commit to finish it."
const NO_REPOSITORY = "This folder is not a Git repository"
const NO_REPOSITORY_HINT = "Initialize one to track changes, commit and sync your collection."
const NO_FOLDER = "Git works on folder workspaces"
const NO_FOLDER_HINT = "Open or save the collection to a folder first, or clone a repository from the folder menu."
const CLEAN = "No changes. Your collection matches the last commit."
const PICK_FILE = "Select a file to see what changed."
const MESSAGE_PLACEHOLDER = "Commit message"
const STATUS_LABELS = { M: "Modified", A: "Added", D: "Deleted", R: "Renamed", C: "Copied", T: "Type changed", U: "New", "?": "New" }
const SECTION_CLASS = "px-3 pb-1 pt-3"

const letterOf = (change, staged) => (change.untracked ? "U" : staged ? change.index : change.worktree)

function ChangeRow({ change, staged, isSelected, isReadOnly, actions }) {
  const letter = letterOf(change, staged)
  const toggleLabel = staged ? "Unstage" : "Stage"
  const ToggleIcon = staged ? Minus : Plus
  return (
    <div className={`group flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs ${isSelected ? "bg-muted" : "hover:bg-accent"}`}>
      <button type="button" onClick={() => actions.select(change, staged)} className="flex min-w-0 flex-1 flex-col text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span title={STATUS_LABELS[letter]} className="w-3 shrink-0 font-mono font-medium text-muted-foreground">{letter}</span>
          <span className="truncate" title={change.path}>{change.path}</span>
        </span>
        {change.summary.length > 0 && <span className="truncate pl-5 text-muted-foreground" title={change.summary.join("\n")}>{change.summary[0]}</span>}
      </button>
      <IconButton label={`History of ${change.path}`} icon={History} size="icon-xs" onClick={() => actions.showHistory(change.path)} />
      {!staged && !change.conflict && <IconButton label={`Discard ${change.path}`} icon={Undo2} size="icon-xs" disabled={isReadOnly} onClick={() => actions.discard(change)} />}
      {!change.conflict && <IconButton label={`${toggleLabel} ${change.path}`} icon={ToggleIcon} size="icon-xs" disabled={isReadOnly} onClick={() => (staged ? actions.unstage([change.path]) : actions.stage([change.path]))} />}
    </div>
  )
}

function ChangeSection({ title, changes, staged, selection, isReadOnly, actions, extra }) {
  if (changes.length === 0) return null
  return (
    <section>
      <div className={`${SECTION_CLASS} flex items-center justify-between`}>
        <SectionLabel>{title} ({changes.length})</SectionLabel>
        {extra}
      </div>
      {changes.map((change) => (
        <ChangeRow
          key={`${staged}:${change.path}`}
          change={change}
          staged={staged}
          isSelected={selection?.path === change.path && selection.staged === staged}
          isReadOnly={isReadOnly}
          actions={actions}
        />
      ))}
    </section>
  )
}

function CommitBox({ stagedCount, hasChanges, hasConflicts, isDisabled, onCommit }) {
  const [message, setMessage] = useState("")
  const commitAll = stagedCount === 0
  const canCommit = !isDisabled && !hasConflicts && hasChanges && message.trim() !== ""
  const commit = async () => {
    await onCommit(message, commitAll)
    setMessage("")
  }
  return (
    <div className="shrink-0 space-y-2 border-t border-border p-3">
      <Textarea aria-label={MESSAGE_PLACEHOLDER} placeholder={MESSAGE_PLACEHOLDER} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
      <Button className="w-full" disabled={!canCommit} onClick={commit}>
        {commitAll ? "Commit all changes" : `Commit ${pluralize(stagedCount, "staged file")}`}
      </Button>
    </div>
  )
}

function ChangesTab({ state, selection, diff, conflict, isBusy, actions }) {
  const isReadOnly = state.restricted || isBusy
  const conflicts = useMemo(() => state.changes.filter((change) => change.conflict), [state.changes])
  const staged = useMemo(() => state.changes.filter(isStaged), [state.changes])
  const unstaged = useMemo(() => state.changes.filter(hasWorktreeChange), [state.changes])
  const selected = state.changes.find((change) => change.path === selection?.path)
  const shared = { selection, isReadOnly, actions }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 w-80 shrink-0 flex-col border-r border-border">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.changes.length === 0 && <EmptyState icon={GitBranch} title={CLEAN} />}
          <ChangeSection title="Conflicts" changes={conflicts} staged={false} {...shared} />
          <ChangeSection title="Staged" changes={staged} staged {...shared} />
          <ChangeSection
            title="Changes"
            changes={unstaged}
            staged={false}
            {...shared}
            extra={<Button size="sm" variant="ghost" disabled={isReadOnly} onClick={actions.stageAll}>Stage all</Button>}
          />
        </div>
        <CommitBox
          stagedCount={staged.length}
          hasChanges={state.changes.length > 0}
          hasConflicts={conflicts.length > 0}
          isDisabled={isReadOnly}
          onCommit={actions.commit}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!selected && <EmptyState icon={GitBranch} title={PICK_FILE} />}
        {selected && conflict && <ConflictEditor key={conflict.path} conflict={conflict} isBusy={isReadOnly} onResolve={actions.resolve} />}
        {selected && diff && <GitDiffView text={diff.text} binary={diff.binary} summary={selected.summary} />}
      </div>
    </div>
  )
}

function SyncButtons({ state, isDisabled, actions }) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" disabled={isDisabled || state.restricted} onClick={actions.fetch}>
        <CloudDownload />
        Fetch
      </Button>
      <Button size="sm" variant="ghost" disabled={isDisabled || state.restricted} onClick={actions.pull}>
        <ArrowDown />
        Pull{state.behind > 0 && ` ${state.behind}`}
      </Button>
      <Button size="sm" variant="ghost" disabled={isDisabled || state.restricted} onClick={actions.push}>
        <ArrowUp />
        Push{state.ahead > 0 && ` ${state.ahead}`}
      </Button>
    </div>
  )
}

function Unavailable({ state, actions }) {
  if (!state.installed) return <EmptyState icon={GitBranch} title="Git is not installed" description={state.installHint} />
  if (!state.hasFolder) return <EmptyState icon={GitBranch} title={NO_FOLDER} description={NO_FOLDER_HINT} />
  if (state.problem) return <EmptyState icon={GitBranch} title="Git cannot use this folder" description={state.problem} />
  return (
    <EmptyState
      icon={GitBranch}
      title={NO_REPOSITORY}
      description={NO_REPOSITORY_HINT}
      action={<Button disabled={state.restricted} onClick={actions.init}>Initialize repository</Button>}
    />
  )
}

function TabBody({ tab, store, actions }) {
  const { state, isBusy } = store
  const isReadOnly = state.restricted || isBusy
  if (tab === TAB_BRANCHES) return <BranchesTab branches={store.branches} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_STASHES) return <StashesTab stashes={store.stashes} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_HISTORY) return <HistoryTab key={store.history.path} history={store.history} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_REMOTES) return <RemotesTab remotes={state.remotes} isReadOnly={isReadOnly} actions={actions} />
  return <ChangesTab state={state} selection={store.selection} diff={store.diff} conflict={store.conflict} isBusy={isBusy} actions={actions} />
}

export function GitPanel({ actions, onTrust }) {
  const store = useGitStore()
  const { state, tab, isOpen, isBusy, output } = store
  const conflictCount = state.changes.filter((change) => change.conflict).length

  useEffect(() => {
    if (isOpen) actions.refresh()
  }, [isOpen, actions])

  if (!isOpen) return null

  return (
    <Dialog label="Git" onClose={actions.close} className="h-[42rem] max-w-5xl">
      <DialogHeader onClose={actions.close}>
        <DialogTitle>Git</DialogTitle>
        {state.isRepo && (
          <Badge variant="outline" title={state.upstream || "No upstream branch"}>
            <GitBranch className="mr-1 size-3" />
            {state.detached ? "Detached HEAD" : state.branch}
          </Badge>
        )}
        {state.isRepo && <div className="ml-auto"><SyncButtons state={state} isDisabled={isBusy} actions={actions} /></div>}
      </DialogHeader>
      {state.restricted && (
        <Notice tone="warning" icon={ShieldAlert}>
          {RESTRICTED_NOTICE}{" "}
          <button type="button" className="underline" onClick={onTrust}>Trust this folder</button>
        </Notice>
      )}
      {state.merging && (
        <Notice tone="warning" icon={GitMerge}>
          {MERGE_NOTICE} {conflictCount > 0 && pluralize(conflictCount, "file") + " still in conflict."}{" "}
          <button type="button" className="underline" disabled={isBusy || state.restricted} onClick={actions.abortMerge}>Abort merge</button>
        </Notice>
      )}
      {output && <Notice tone="muted" className="max-h-24 overflow-y-auto whitespace-pre-wrap">{output}</Notice>}
      {state.isRepo ? (
        <>
          <div className="flex shrink-0 items-center border-b border-border px-3 py-1.5">
            <SegmentedControl label="Git sections" options={TABS} value={tab} onChange={actions.setTab} />
          </div>
          <TabBody tab={tab} store={store} actions={actions} />
        </>
      ) : (
        <Unavailable state={state} actions={actions} />
      )}
    </Dialog>
  )
}
