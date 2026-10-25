import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, CloudDownload, Folder, GitBranch, GitMerge, History, Minus, Plus, ShieldAlert, Undo2 } from "lucide-react"
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
import { TAB_BRANCHES, TAB_CHANGES, TAB_HISTORY, TAB_REMOTES, TAB_STASHES, hasWorktreeChange, isStaged, useGitStore } from "../lib/gitSession"
import { GIT_TEXT as TEXT } from "../lib/gitText"
import { WORKSPACE_TEXT } from "../lib/workspaceText"

const tabOptions = () => [
  { value: TAB_CHANGES, label: TEXT.tabs.changes },
  { value: TAB_BRANCHES, label: TEXT.tabs.branches },
  { value: TAB_STASHES, label: TEXT.tabs.stashes },
  { value: TAB_HISTORY, label: TEXT.tabs.history },
  { value: TAB_REMOTES, label: TEXT.tabs.remotes },
]
const SECTION_CLASS = "px-3 pb-1 pt-3"

const letterOf = (change, staged) => (change.untracked ? "U" : staged ? change.index : change.worktree)

function ChangeRow({ change, staged, isSelected, isReadOnly, actions }) {
  const letter = letterOf(change, staged)
  const toggleLabel = staged ? TEXT.unstage : TEXT.stage
  const ToggleIcon = staged ? Minus : Plus
  return (
    <div className={`group flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs ${isSelected ? "bg-muted" : "hover:bg-accent"}`}>
      <button type="button" onClick={() => actions.select(change, staged)} className="flex min-w-0 flex-1 flex-col text-start">
        <span className="flex min-w-0 items-center gap-2">
          <span title={change.conflict ? TEXT.conflictLabel : TEXT.statusLabels[letter]} className="w-3 shrink-0 font-mono font-medium text-muted-foreground">{letter}</span>
          <span className="truncate" title={change.path}>{change.path}</span>
        </span>
        {change.summary.length > 0 && <span className="truncate ps-5 text-muted-foreground" title={change.summary.join("\n")}>{change.summary[0]}</span>}
      </button>
      <IconButton label={TEXT.historyOf(change.path)} icon={History} size="icon-xs" onClick={() => actions.showHistory(change.path)} />
      {!staged && !change.conflict && <IconButton label={TEXT.discard(change.path)} icon={Undo2} size="icon-xs" disabled={isReadOnly} onClick={() => actions.discard(change)} />}
      {!change.conflict && <IconButton label={toggleLabel(change.path)} icon={ToggleIcon} size="icon-xs" disabled={isReadOnly} onClick={() => (staged ? actions.unstage([change.path]) : actions.stage([change.path]))} />}
    </div>
  )
}

function ChangeSection({ title, changes, staged, selection, isReadOnly, actions, extra }) {
  if (changes.length === 0) return null
  return (
    <section>
      <div className={`${SECTION_CLASS} flex items-center justify-between`}>
        <SectionLabel>{TEXT.sectionTitle(title, changes.length)}</SectionLabel>
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

function commitLabel(stagedCount, hasChanges, isMerging) {
  if (isMerging && !hasChanges) return TEXT.commitMerge
  return stagedCount === 0 ? TEXT.commitAll : TEXT.commitStaged(stagedCount)
}

function CommitBox({ stagedCount, hasChanges, hasConflicts, isMerging, isDisabled, onCommit }) {
  const [message, setMessage] = useState("")
  const commitAll = stagedCount === 0
  const canCommit = !isDisabled && !hasConflicts && (hasChanges || isMerging) && message.trim() !== ""
  const commit = async () => {
    await onCommit(message, commitAll)
    setMessage("")
  }
  return (
    <div className="shrink-0 space-y-2 border-t border-border p-3">
      <Textarea aria-label={TEXT.commitMessage} placeholder={TEXT.commitMessage} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
      <Button className="w-full" disabled={!canCommit} onClick={commit}>
        {commitLabel(stagedCount, hasChanges, isMerging)}
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
      <div className="flex min-h-0 w-80 shrink-0 flex-col border-e border-border">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {state.changes.length === 0 && <EmptyState icon={state.merging ? GitMerge : GitBranch} title={state.merging ? TEXT.mergeReady : TEXT.clean} />}
          <ChangeSection title={TEXT.sections.conflicts} changes={conflicts} staged={false} {...shared} />
          <ChangeSection title={TEXT.sections.staged} changes={staged} staged {...shared} />
          <ChangeSection
            title={TEXT.sections.changes}
            changes={unstaged}
            staged={false}
            {...shared}
            extra={<Button size="sm" variant="ghost" disabled={isReadOnly} onClick={actions.stageAll}>{TEXT.stageAll}</Button>}
          />
        </div>
        <CommitBox
          stagedCount={staged.length}
          hasChanges={state.changes.length > 0}
          hasConflicts={conflicts.length > 0}
          isMerging={state.merging}
          isDisabled={isReadOnly}
          onCommit={actions.commit}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!selected && <EmptyState icon={GitBranch} title={TEXT.pickFile} />}
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
        {TEXT.fetch}
      </Button>
      <Button size="sm" variant="ghost" disabled={isDisabled || state.restricted} onClick={actions.pull}>
        <ArrowDown />
        {TEXT.pull(state.behind)}
      </Button>
      <Button size="sm" variant="ghost" disabled={isDisabled || state.restricted} onClick={actions.push}>
        <ArrowUp />
        {TEXT.push(state.ahead)}
      </Button>
    </div>
  )
}

function Unavailable({ state, actions }) {
  if (!state.installed) return <EmptyState icon={GitBranch} title={TEXT.notInstalled} description={state.installHint} />
  if (!state.hasFolder) return <EmptyState icon={GitBranch} title={TEXT.noFolder} description={TEXT.noFolderHint} />
  if (state.problem) return <EmptyState icon={GitBranch} title={TEXT.cannotUseFolder} description={state.problem} />
  return (
    <EmptyState
      icon={GitBranch}
      title={TEXT.noRepository}
      description={TEXT.noRepositoryHint}
      action={<Button disabled={state.restricted} onClick={actions.init}>{TEXT.initialize}</Button>}
    />
  )
}

function TabBody({ tab, store, actions }) {
  const { state, isBusy } = store
  const isReadOnly = state.restricted || isBusy
  if (tab === TAB_BRANCHES) return <BranchesTab branches={store.branches} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_STASHES) return <StashesTab stashes={store.stashes} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_HISTORY) return <HistoryTab key={store.history.path} history={store.history} isReadOnly={isReadOnly} actions={actions} />
  if (tab === TAB_REMOTES) return <RemotesTab remotes={state.remotes} isReadOnly={isReadOnly} isRestricted={state.restricted} actions={actions} />
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
    <Dialog label={TEXT.title} size="lg" onClose={actions.close} className="h-[42rem] max-w-5xl">
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{TEXT.title}</DialogTitle>
        {state.isRepo && (
          <Badge variant="outline" title={state.upstream || TEXT.noUpstream}>
            <GitBranch className="me-1 size-3" />
            {state.detached ? TEXT.detached : state.branch}
          </Badge>
        )}
        {state.isRepo && state.scope && (
          <Badge variant="outline" title={TEXT.scopeTitle}>
            <Folder className="me-1 size-3" />
            {TEXT.scope(state.scope)}
          </Badge>
        )}
        {state.isRepo && <div className="ms-auto"><SyncButtons state={state} isDisabled={isBusy} actions={actions} /></div>}
      </DialogHeader>
      {state.restricted && (
        <Notice tone="warning" icon={ShieldAlert}>
          {TEXT.restrictedNotice}{" "}
          <button type="button" className="underline" onClick={onTrust}>{WORKSPACE_TEXT.trust}</button>
        </Notice>
      )}
      {state.merging && (
        <Notice tone="warning" icon={GitMerge}>
          {TEXT.mergeNotice} {conflictCount > 0 && TEXT.stillInConflict(conflictCount)}{" "}
          <button type="button" className="underline" disabled={isBusy || state.restricted} onClick={actions.abortMerge}>{TEXT.abortMerge}</button>
        </Notice>
      )}
      {output && <Notice tone="muted" className="max-h-24 overflow-y-auto whitespace-pre-wrap">{output}</Notice>}
      {state.isRepo ? (
        <>
          <div className="flex shrink-0 items-center border-b border-border px-3 py-1.5">
            <SegmentedControl label={TEXT.sectionsLabel} options={tabOptions()} value={tab} onChange={actions.setTab} />
          </div>
          <TabBody tab={tab} store={store} actions={actions} />
        </>
      ) : (
        <Unavailable state={state} actions={actions} />
      )}
    </Dialog>
  )
}
