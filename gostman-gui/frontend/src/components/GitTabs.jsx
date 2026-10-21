import { useState } from "react"
import { ExternalLink, GitBranch, History, Plus, RotateCcw, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button, IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { GitDiffView } from "./GitDiffView"
import { useAppStore } from "../store/appStore"

const ROW_CLASS = "flex min-h-9 items-center gap-2 border-b border-border px-3 text-xs"
const FORM_CLASS = "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2"
const NO_BRANCHES = "This repository has no branches yet. Commit something first."
const NO_STASHES = "Nothing is stashed. A stash sets your uncommitted changes aside so you can switch branches cleanly."
const NO_COMMITS = "No commits yet."
const NO_REMOTES = "No remotes. Add the address of a repository to fetch, pull and push."
const READ_ONLY = "Trust this folder to change anything."
const SHORT_DATE = { dateStyle: "medium", timeStyle: "short" }

const formatDate = (iso) => new Date(iso).toLocaleString(undefined, SHORT_DATE)

function AddForm({ placeholder, label, icon: Icon, disabled, onSubmit }) {
  const [text, setText] = useState("")
  const submit = (event) => {
    event.preventDefault()
    if (!text.trim()) return
    onSubmit(text.trim())
    setText("")
  }
  return (
    <form onSubmit={submit} className={FORM_CLASS}>
      <Input aria-label={label} placeholder={placeholder} value={text} onChange={(event) => setText(event.target.value)} disabled={disabled} />
      <Button type="submit" size="sm" disabled={disabled || !text.trim()}>
        <Icon />
        {label}
      </Button>
    </form>
  )
}

export function BranchesTab({ branches, isReadOnly, actions }) {
  const local = branches.filter((branch) => !branch.remote)
  const remote = branches.filter((branch) => branch.remote)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AddForm label="Create branch" placeholder="New branch name, created from the current commit" icon={Plus} disabled={isReadOnly} onSubmit={actions.createBranch} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {branches.length === 0 && <EmptyState icon={GitBranch} title={NO_BRANCHES} />}
        {local.map((branch) => (
          <div key={branch.name} className={ROW_CLASS}>
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium" title={branch.subject}>{branch.name}</span>
            {branch.current && <Badge variant="success">current</Badge>}
            {branch.upstream && <span className="truncate text-muted-foreground">{branch.upstream}</span>}
            {!branch.current && <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => actions.switchBranch(branch.name, false)}>Switch</Button>}
            {!branch.current && <IconButton label={`Delete ${branch.name}`} icon={Trash2} disabled={isReadOnly} onClick={() => actions.deleteBranch(branch.name)} />}
          </div>
        ))}
        {remote.length > 0 && <div className="px-3 pb-1 pt-3"><SectionLabel>Remote branches</SectionLabel></div>}
        {remote.map((branch) => (
          <div key={branch.name} className={ROW_CLASS}>
            <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate" title={branch.subject}>{branch.name}</span>
            <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => actions.switchBranch(branch.name, true)}>Check out</Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StashesTab({ stashes, isReadOnly, actions }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AddForm label="Stash changes" placeholder="Optional note" icon={Plus} disabled={isReadOnly} onSubmit={actions.saveStash} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {stashes.length === 0 && <EmptyState icon={History} title={NO_STASHES} />}
        {stashes.map((stash) => (
          <div key={stash.index} className={ROW_CLASS}>
            <span className="min-w-0 flex-1 truncate" title={stash.message}>{stash.message}</span>
            <span className="shrink-0 text-muted-foreground">{formatDate(stash.date)}</span>
            <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => actions.applyStash(stash.index)}>Apply</Button>
            <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => actions.popStash(stash.index)}>Pop</Button>
            <IconButton label="Drop stash" icon={Trash2} disabled={isReadOnly} onClick={() => actions.dropStash(stash.index)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function VersionPane({ version, isReadOnly, onRestore }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="truncate text-xs text-muted-foreground">{version.commit.short} {version.commit.subject}</span>
        <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => onRestore(version.commit)}>
          <RotateCcw />
          Restore this version
        </Button>
      </div>
      <GitDiffView text={version.diff} binary={false} summary={[]} />
    </div>
  )
}

export function HistoryTab({ history, isReadOnly, actions }) {
  const [path, setPath] = useState(history.path)
  const submit = (event) => {
    event.preventDefault()
    actions.showHistory(path.trim())
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className={FORM_CLASS}>
        <Input aria-label="File path" placeholder="File path for a single file's history, empty for the whole repository" value={path} onChange={(event) => setPath(event.target.value)} />
        <Button type="submit" size="sm" variant="outline">Show history</Button>
      </form>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 w-80 shrink-0 overflow-y-auto border-r border-border">
          {history.commits.length === 0 && <EmptyState icon={History} title={NO_COMMITS} />}
          {history.commits.map((commit) => (
            <button
              key={commit.hash}
              type="button"
              disabled={!history.path}
              onClick={() => actions.showVersion(commit)}
              className="block w-full border-b border-border px-3 py-2 text-left text-xs enabled:hover:bg-accent"
            >
              <span className="block truncate font-medium">{commit.subject}</span>
              <span className="block truncate text-muted-foreground">{commit.short} · {commit.author} · {formatDate(commit.date)}</span>
            </button>
          ))}
        </div>
        {history.version && <VersionPane version={history.version} isReadOnly={isReadOnly} onRestore={actions.restoreVersion} />}
      </div>
    </div>
  )
}

function RemoteRow({ remote, isReadOnly, onChange }) {
  const showPrompt = useAppStore((s) => s.showPrompt)
  return (
    <div className={ROW_CLASS}>
      <span className="shrink-0 font-medium">{remote.name}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={remote.url}>{remote.url}</span>
      <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => showPrompt("Change remote address", `New address for ${remote.name}`, remote.url, "", (url) => url?.trim() && onChange(url.trim()))}>
        Change
      </Button>
    </div>
  )
}

export function RemotesTab({ remotes, isReadOnly, actions }) {
  const [name, setName] = useState("origin")
  const [url, setUrl] = useState("")
  const submit = (event) => {
    event.preventDefault()
    actions.addRemote(name.trim(), url.trim())
    setUrl("")
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className={FORM_CLASS}>
        <Input aria-label="Remote name" className="w-32 shrink-0" value={name} onChange={(event) => setName(event.target.value)} disabled={isReadOnly} />
        <Input aria-label="Remote address" placeholder="https://github.com/owner/repository.git" value={url} onChange={(event) => setUrl(event.target.value)} disabled={isReadOnly} />
        <Button type="submit" size="sm" disabled={isReadOnly || !name.trim() || !url.trim()}>
          <Plus />
          Add remote
        </Button>
      </form>
      {isReadOnly && <Notice tone="muted">{READ_ONLY}</Notice>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {remotes.length === 0 && <EmptyState icon={ExternalLink} title={NO_REMOTES} />}
        {remotes.map((remote) => (
          <RemoteRow key={remote.name} remote={remote} isReadOnly={isReadOnly} onChange={(next) => actions.setRemoteUrl(remote.name, next)} />
        ))}
      </div>
      {remotes.length > 0 && (
        <div className="flex shrink-0 justify-end border-t border-border px-3 py-2">
          <Button size="sm" variant="outline" onClick={actions.openPullRequest}>
            <ExternalLink />
            Create pull request in browser
          </Button>
        </div>
      )}
    </div>
  )
}
